const mongoose = require('mongoose');
const ServiceOffer = require('../models/ServiceOffer');
const OfferService = require('../services/OfferService');
const AuditLog = require('../models/AuditLog');

/**
 * Admin "🎁 Offer Management" plus the customer-facing offer reads.
 *
 * Kept separate from controllers/offerController.js, which handles the
 * unrelated provider-submitted promo approval queue.
 */

const logOfferAction = async (req, actionType, offer, details = {}) => {
    try {
        await AuditLog.create({
            actionType,
            entityType: 'SERVICE_OFFER',
            entityId: offer._id,
            entityName: `${offer.serviceName} @ Rs ${offer.offerPrice}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || 'Admin',
            verifiedByRole: req.user.role || 'admin',
            details
        });
    } catch (err) {
        console.error('[Offers] Audit log write failed:', err.message);
    }
};

// @desc    Catalog picker — every service that can carry an offer, with its
//          current price so the admin UI can show MRP without a second call.
// @route   GET /api/admin/offers/targets
// @access  Private (Admin)
const getOfferTargets = async (req, res) => {
    try {
        const Service = require('../models/Service');
        const Category = require('../models/Category');

        const [services, categories] = await Promise.all([
            Service.find({ price: { $gt: 0 } })
                .select('name price category categoryId visible')
                .sort({ name: 1 })
                .lean(),
            Category.find().select('name services').lean()
        ]);

        const targets = [
            ...services.map(s => ({
                targetType: 'service',
                serviceId: s._id,
                itemId: s._id,
                label: s.name,
                categoryName: s.category || '',
                originalPrice: Number(s.price) || 0,
                catalog: 'Partner service',
                visible: s.visible !== false
            })),
            // Sewak catalog lives embedded in each Category.
            ...categories.flatMap(cat =>
                (cat.services || [])
                    .filter(sub => Number(sub.basePrice) > 0)
                    .map(sub => ({
                        targetType: 'category_service',
                        categoryId: cat._id,
                        subServiceId: sub._id,
                        itemId: sub._id,
                        label: sub.name,
                        categoryName: cat.name,
                        originalPrice: Number(sub.basePrice) || 0,
                        catalog: 'Sewak service',
                        visible: true
                    }))
            )
        ];

        res.json({ targets });
    } catch (error) {
        console.error('[Offers] getOfferTargets failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    List offers for the admin table
// @route   GET /api/admin/offers
// @access  Private (Admin)
const getAdminOffers = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.search) {
            query.serviceName = new RegExp(String(req.query.search).trim(), 'i');
        }

        const [offers, total] = await Promise.all([
            ServiceOffer.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            ServiceOffer.countDocuments(query)
        ]);

        const now = new Date();
        res.json({
            // Report the live lifecycle rather than the stored label, so the
            // table is correct even if the cron hasn't run since a date passed.
            offers: offers.map(o => ({ ...o, status: OfferService.deriveStatus(o, now) })),
            total,
            page,
            pages: Math.ceil(total / limit) || 1
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create an offer
// @route   POST /api/admin/offers
// @access  Private (Admin)
const createOffer = async (req, res) => {
    try {
        const fields = await OfferService.buildOfferFields(req.body);

        // One live offer per item keeps the card unambiguous. An overlapping
        // one is refused rather than silently shadowed.
        const clashQuery = fields.targetType === 'service'
            ? { targetType: 'service', serviceId: fields.serviceId }
            : { targetType: 'category_service', categoryId: fields.categoryId, subServiceId: fields.subServiceId };

        const clash = await ServiceOffer.findOne({
            ...clashQuery,
            isActive: true,
            startDate: { $lte: fields.endDate },
            endDate: { $gte: fields.startDate }
        }).lean();

        if (clash) {
            return res.status(409).json({
                message: `"${fields.serviceName}" already has an active offer overlapping those dates (Rs ${clash.offerPrice}, ends ${new Date(clash.endDate).toLocaleDateString('en-IN')}). Deactivate it first or pick different dates.`
            });
        }

        const offer = await ServiceOffer.create({ ...fields, createdBy: req.user._id });
        await logOfferAction(req, 'OFFER_CREATED', offer, {
            originalPrice: offer.originalPrice,
            offerPrice: offer.offerPrice,
            discountPercent: offer.discountPercent,
            allowCoins: offer.allowCoins
        });

        res.status(201).json({ message: 'Offer created.', offer });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update an offer
// @route   PUT /api/admin/offers/:id
// @access  Private (Admin)
const updateOffer = async (req, res) => {
    try {
        const existing = await ServiceOffer.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Offer not found.' });

        // Rebuild from the catalog so MRP and the discount percent are always
        // refreshed against the item's current price on every save.
        const fields = await OfferService.buildOfferFields({
            targetType: req.body.targetType || existing.targetType,
            serviceId: req.body.serviceId !== undefined ? req.body.serviceId : existing.serviceId,
            categoryId: req.body.categoryId !== undefined ? req.body.categoryId : existing.categoryId,
            subServiceId: req.body.subServiceId !== undefined ? req.body.subServiceId : existing.subServiceId,
            offerPrice: req.body.offerPrice !== undefined ? req.body.offerPrice : existing.offerPrice,
            startDate: req.body.startDate || existing.startDate,
            endDate: req.body.endDate || existing.endDate,
            image: req.body.image !== undefined ? req.body.image : existing.image,
            isActive: req.body.isActive !== undefined ? req.body.isActive : existing.isActive,
            allowCoins: req.body.allowCoins !== undefined ? req.body.allowCoins : existing.allowCoins
        });

        Object.assign(existing, fields);
        await existing.save();

        await logOfferAction(req, 'OFFER_UPDATED', existing, { offerPrice: existing.offerPrice });
        res.json({ message: 'Offer updated.', offer: existing });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Flip the Active / Inactive switch
// @route   PATCH /api/admin/offers/:id/status
// @access  Private (Admin)
const toggleOfferStatus = async (req, res) => {
    try {
        const offer = await ServiceOffer.findById(req.params.id);
        if (!offer) return res.status(404).json({ message: 'Offer not found.' });

        offer.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !offer.isActive;
        offer.status = OfferService.deriveStatus(offer);
        await offer.save();

        await logOfferAction(req, offer.isActive ? 'OFFER_ACTIVATED' : 'OFFER_DEACTIVATED', offer, {
            isActive: offer.isActive
        });
        res.json({ message: offer.isActive ? 'Offer activated.' : 'Offer deactivated.', offer });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete an offer
// @route   DELETE /api/admin/offers/:id
// @access  Private (Admin)
const deleteOffer = async (req, res) => {
    try {
        const offer = await ServiceOffer.findById(req.params.id);
        if (!offer) return res.status(404).json({ message: 'Offer not found.' });

        await logOfferAction(req, 'OFFER_DELETED', offer, {
            offerPrice: offer.offerPrice,
            discountPercent: offer.discountPercent
        });
        await offer.deleteOne();

        // Bookings keep their own offerSnapshot, so deleting an offer never
        // rewrites the price a past customer was charged.
        res.json({ message: 'Offer removed.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ----------------------------- Customer app ----------------------------- */

// @desc    Live offers for the customer app — the dedicated Offers tab and the
//          home carousel both read this.
// @route   GET /api/public/offers
// @access  Public
const getPublicOffers = async (req, res) => {
    try {
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));

        // Always filtered on the live date window, never on the stored status —
        // a missed cron run must not leave an expired offer bookable.
        const offers = await ServiceOffer.find(OfferService.liveFilter())
            .sort({ discountPercent: -1, endDate: 1 })
            .limit(limit)
            .lean();

        // Drop any whose catalog item has since been deleted, so a removed
        // service can't keep advertising itself from an offer card.
        const cards = [];
        for (const offer of offers) {
            const catalog = await OfferService.resolveCatalogTarget(offer);
            if (!catalog) continue;
            cards.push(OfferService.toPublicCard(offer));
        }

        res.json({ offers: cards });
    } catch (error) {
        console.error('[Offers] getPublicOffers failed:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getOfferTargets,
    getAdminOffers,
    createOffer,
    updateOffer,
    toggleOfferStatus,
    deleteOffer,
    getPublicOffers
};
