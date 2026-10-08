const Service = require('../models/Service');
const Combo = require('../models/Combo');
const Category = require('../models/Category');
const Provider = require('../models/Provider');
const SkillSession = require('../models/SkillSession');
const { releaseServiceImage } = require('../utils/serviceImageCleanup');

const normalizeKey = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * Skill Session state for one catalog entry, from the Sewak's point of view.
 * `locked` is what the UI gates on.
 */
const skillStateFor = (catalogEntry, provider, sessionsByKey) => {
    const required = !!catalogEntry?.skillSessionRequired && catalogEntry?.skillSessionActive !== false;
    if (!required) {
        return { skillSessionRequired: false, skillSessionStatus: 'not_required', locked: false };
    }

    const key = normalizeKey(catalogEntry.name);
    const certified = (provider.skillCertifications || []).some(c =>
        String(c.categoryId) === String(provider.vendorType?._id || provider.vendorType) && c.serviceKey === key
    );
    if (certified) {
        return {
            skillSessionRequired: true,
            skillSessionStatus: 'completed',
            skillSessionMode: catalogEntry.sessionMode || 'offline',
            locked: false
        };
    }

    const latest = sessionsByKey.get(key);
    return {
        skillSessionRequired: true,
        skillSessionStatus: latest ? latest.status : 'not_booked',
        skillSessionMode: catalogEntry.sessionMode || 'offline',
        skillSessionId: latest?._id || null,
        locked: true
    };
};

// @desc    Get all services for logged in provider
// @route   GET /api/services
// @access  Private (Provider)
const getMyServices = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id).populate('vendorType');
        const isSewak = provider?.providerCategory === 'sewak';

        let services = await Service.find({ providerId: req.user._id });
        let combos = await Combo.find({ providerId: req.user._id }).populate('services');

        // Services added before the subcategory was saved have none. Take it
        // from the admin catalog service of the same name, once.
        const withoutSubcategory = isSewak ? [] : services.filter(s => !s.subcategory);
        if (withoutSubcategory.length > 0 && provider?.vendorType?._id) {
            const catalogRows = await Service.find({
                providerId: null,
                categoryId: provider.vendorType._id,
                subcategory: { $nin: [null, ''] }
            }).select('name subcategory subcategoryId').lean();
            const byName = new Map(catalogRows.map(r => [normalizeKey(r.name), r]));
            const ops = [];
            for (const svc of withoutSubcategory) {
                const row = byName.get(normalizeKey(svc.name));
                if (!row) continue;
                svc.subcategory = row.subcategory;
                svc.subcategoryId = row.subcategoryId;
                ops.push({ updateOne: {
                    filter: { _id: svc._id, subcategory: { $in: [null, ''] } },
                    update: { $set: { subcategory: row.subcategory, subcategoryId: row.subcategoryId } }
                } });
            }
            if (ops.length > 0) await Service.bulkWrite(ops);
        }

        const visibleForType = isSewak ? 'sewak' : 'partner';
        const categoryServices = (provider?.vendorType?.services || []).filter(
            s => !s.visibleTo || s.visibleTo === 'both' || s.visibleTo === visibleForType
        );
        const categoryCombos = provider?.vendorType?.combos || [];
        const categoryName = provider?.vendorType?.name || 'Your Category';

        // Latest non-cancelled session per service, for the Skill Session badges.
        const sessionsByKey = new Map();
        if (isSewak) {
            // One badge per service, so only the fields a badge shows — and a
            // ceiling, since re-sessions accumulate.
            const sessions = await SkillSession.find({
                sewakId: req.user._id,
                status: { $ne: 'cancelled' }
            })
                .select('serviceKey serviceName status mode scheduledDate scheduledTime centerId')
                .sort({ createdAt: -1 })
                .limit(1000)
                .lean();
            for (const s of sessions) {
                if (!sessionsByKey.has(s.serviceKey)) sessionsByKey.set(s.serviceKey, s);
            }
        }

        if (isSewak) {
            // For Sewaks, we override the services list with category services using admin prices (only basePrice > 0)
            const validCategoryServices = categoryServices.filter(catSvc => Number(catSvc.basePrice) > 0);
            services = validCategoryServices.map(catSvc => ({
                _id: catSvc._id,
                name: catSvc.name,
                description: catSvc.description || `Professional ${catSvc.name} service`,
                duration: "1 hour",
                visible: true,
                category: categoryName,
                price: Number(catSvc.basePrice),
                ...skillStateFor(catSvc, provider, sessionsByKey)
            }));

            // Map category combos to the format expected by frontend
            combos = categoryCombos.map(catCombo => ({
                _id: catCombo._id,
                name: catCombo.name,
                description: catCombo.description,
                price: catCombo.sewakPrice || 0,
                image: catCombo.image,
                services: catCombo.services.map(svcName => {
                    const s = services.find(s => s.name === svcName);
                    return s || { name: svcName };
                })
            }));
        }

        const annotatedCategoryServices = isSewak
            ? categoryServices.map(cs => ({
                ...(cs.toObject ? cs.toObject() : cs),
                ...skillStateFor(cs, provider, sessionsByKey)
            }))
            : categoryServices;

        res.json({ services, combos, categoryServices: annotatedCategoryServices, categoryName });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new service
// @route   POST /api/services
// @access  Private (Provider)
// The ways a partner can offer a service (Service.serviceType).
const SERVICE_TYPES = ['home', 'shop', '24x7'];
const cleanServiceTypes = (v) => {
    const list = (Array.isArray(v) ? v : [v]).filter(t => SERVICE_TYPES.includes(t));
    return list.length ? [...new Set(list)] : undefined;
};
const MAX_SERVICE_PRICE = 100000;

/**
 * The services a provider may offer: their own category's catalog — the
 * category's list and its subcategories' services — that their kind of
 * account (partner / sewak) may see. Returns { category, entries } with
 * each entry's name and subcategory, or null without a category.
 */
const categoryCatalogFor = async (provider) => {
    if (!provider?.vendorType) return null;
    const cat = await Category.findById(provider.vendorType).lean();
    if (!cat) return null;
    const visible = (v) => !v || v === 'both' || v === provider.providerCategory;

    // The same catalog the app lists (GET /public/subcategories/all/services):
    // admin rows tied to the category by id, by name, or through one of its
    // subcategories, and the list kept on the Category — unless the admin
    // hid that service.
    const Subcategory = require('../models/Subcategory');
    const subs = await Subcategory.find({ categoryId: cat._id }).select('_id name').lean();
    const subNameById = new Map(subs.map(s => [String(s._id), s.name]));
    const escaped = String(cat.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRx = new RegExp(`^${escaped}$`, 'i');
    const inCategory = {
        providerId: null,
        $or: [
            { categoryId: cat._id },
            { category: nameRx },
            { subcategoryId: { $in: subs.map(s => s._id) } },
            { subcategory: { $in: subs.map(s => s.name) } }
        ]
    };
    const rows = await Service.find(inCategory).select('name subcategory subcategoryId visibleTo visible').lean();
    const hidden = new Set(rows.filter(r => r.visible === false).map(r => normalizeKey(r.name)));
    const entries = [
        ...rows.filter(r => r.visible !== false && visible(r.visibleTo))
            .map(r => ({ name: r.name, subcategory: r.subcategory || subNameById.get(String(r.subcategoryId)) || null })),
        ...(cat.services || []).filter(s => visible(s.visibleTo) && !hidden.has(normalizeKey(s.name)))
            .map(s => ({ name: s.name, subcategory: null }))
    ];
    return { category: cat, entries };
};
const findInCatalog = (catalog, name) => {
    const k = normalizeKey(String(name || ''));
    const hits = (catalog?.entries || []).filter(e => normalizeKey(e.name) === k);
    return hits.find(h => h.subcategory) || hits[0] || null;
};
// A service photo is a link from the upload API (or the catalog), never raw data.
const validImage = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && /^https?:\/\/\S+$/i.test(v) && v.length <= 1000);

const createService = async (req, res) => {
    const { name, description, price, duration, category, subcategory, visible, image, amenities, serviceDetails } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Service name is required' });
    }
    if (price === undefined || price === null || price === "" || Number(price) <= 0) {
        return res.status(400).json({ message: 'Service price is required and must be greater than 0' });
    }
    if (!validImage(req.body.image)) {
        return res.status(400).json({ message: 'Service photo must be an uploaded image' });
    }
    if (Number(price) > MAX_SERVICE_PRICE) {
        return res.status(400).json({ message: `Service price can't be more than ₹${MAX_SERVICE_PRICE}` });
    }

    try {
        // Skill Session gate — the service is saved either way, but held out of sight
        // until training is done, so nothing the Sewak typed is lost. See D8.
        let heldForSkillSession = false;
        let skillFields = {};
        const provider = await Provider.findById(req.user._id).lean();

        // Only a service from the provider's own category: the app lists
        // nothing else, and the server now holds to the same — it used to
        // take any name and any category name sent to it.
        const catalog = await categoryCatalogFor(provider);
        if (!catalog) {
            return res.status(400).json({ message: 'Choose your service category first.' });
        }
        const catalogEntry = findInCatalog(catalog, name);
        if (!catalogEntry) {
            return res.status(400).json({ message: `Choose a service from your category (${catalog.category.name}).` });
        }
        // Once each: a second copy would show twice on the shop page.
        const mine = await Service.find({ providerId: req.user._id }).select('name').lean();
        if (mine.some(s => normalizeKey(s.name) === normalizeKey(name))) {
            return res.status(409).json({ message: `You already offer ${name}. Edit it instead.` });
        }

        if (provider?.providerCategory === 'sewak' && provider.vendorType) {
            const cat = await Category.findById(provider.vendorType).lean();
            const entry = (cat?.services || []).find(s => normalizeKey(s.name) === normalizeKey(name));
            const required = !!entry?.skillSessionRequired && entry?.skillSessionActive !== false;

            if (required) {
                const key = normalizeKey(name);
                const certified = (provider.skillCertifications || []).some(c =>
                    String(c.categoryId) === String(provider.vendorType) && c.serviceKey === key
                );
                heldForSkillSession = !certified;
                skillFields = {
                    skillSessionRequired: true,
                    sessionDurationMinutes: Number(entry.sessionDurationMinutes) || 60,
                    sessionMode: entry.sessionMode || 'offline',
                    skillSessionActive: true
                };
            }
        }

        // A partner who picked services at registration: what they add joins
        // that list (it is what they offer).
        if (provider && provider.providerCategory !== 'sewak' && Array.isArray(provider.subServices) && provider.subServices.length > 0
            && !provider.subServices.some(s => normalizeKey(String(s)) === normalizeKey(name))) {
            await Provider.updateOne({ _id: provider._id }, { $addToSet: { subServices: String(name).trim() } });
        }

        const service = await Service.create({
            providerId: req.user._id,
            name,
            description,
            price,
            duration,
            category: catalog.category.name,
            // The subcategory and service types the partner picked were sent
            // but never saved.
            subcategory: catalogEntry.subcategory || subcategory || undefined,
            serviceType: cleanServiceTypes(req.body.serviceType),
            visible: heldForSkillSession ? false : (visible !== undefined ? visible : true),
            image,
            amenities: amenities || [],
            serviceDetails: serviceDetails || [],
            useCategoryLeadPrice: req.body.useCategoryLeadPrice !== undefined ? req.body.useCategoryLeadPrice : true,
            customLeadPrice: req.body.customLeadPrice !== undefined ? req.body.customLeadPrice : 0,
            pendingSkillSession: heldForSkillSession,
            ...skillFields
        });

        if (service) {
            res.status(201).json({
                ...service.toObject(),
                heldForSkillSession,
                message: heldForSkillSession
                    ? 'Saved. Complete the Skill Session to activate this service.'
                    : undefined
            });
        } else {
            res.status(400).json({ message: 'Invalid service data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Private (Provider)
const updateService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (service) {
            if (service.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            if (req.body.name !== undefined && normalizeKey(String(req.body.name)) !== normalizeKey(service.name)) {
                // Renamed: still only to a service from the provider's own category.
                const owner = await Provider.findById(req.user._id).lean();
                const catalog = await categoryCatalogFor(owner);
                if (!catalog || !findInCatalog(catalog, req.body.name)) {
                    return res.status(400).json({ message: 'Choose a service from your category.' });
                }
                service.name = req.body.name;
            }
            if (req.body.description !== undefined) service.description = req.body.description;
            if (req.body.price !== undefined) {
                if (Number(req.body.price) > MAX_SERVICE_PRICE) {
                    return res.status(400).json({ message: `Service price can't be more than ₹${MAX_SERVICE_PRICE}` });
                }
                service.price = req.body.price;
            }
            if (req.body.subcategory !== undefined) service.subcategory = req.body.subcategory || undefined;
            if (cleanServiceTypes(req.body.serviceType)) service.serviceType = cleanServiceTypes(req.body.serviceType);
            if (req.body.duration !== undefined) service.duration = req.body.duration;
            // A held service can't be made visible from here — only completing the
            // Skill Session releases it.
            if (req.body.visible !== undefined) {
                if (service.pendingSkillSession && req.body.visible === true) {
                    return res.status(400).json({ message: 'Complete the Skill Session before activating this service.' });
                }
                service.visible = req.body.visible;
            }
            let replacedImage = null;
            if (req.body.image !== undefined) {
                if (!validImage(req.body.image)) {
                    return res.status(400).json({ message: 'Service photo must be an uploaded image' });
                }
                if (service.image && service.image !== req.body.image) replacedImage = service.image;
                service.image = req.body.image;
            }
            if (req.body.amenities !== undefined) service.amenities = req.body.amenities;
            if (req.body.serviceDetails !== undefined) service.serviceDetails = req.body.serviceDetails;
            if (req.body.useCategoryLeadPrice !== undefined) service.useCategoryLeadPrice = req.body.useCategoryLeadPrice;
            if (req.body.customLeadPrice !== undefined) service.customLeadPrice = req.body.customLeadPrice;

            const updatedService = await service.save();
            // A replaced photo is removed once nothing else uses it.
            if (replacedImage) releaseServiceImage(replacedImage);
            res.json(updatedService);
        } else {
            res.status(404).json({ message: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a service
// @route   DELETE /api/services/:id
// @access  Private (Provider)
const deleteService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (service) {
            if (service.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            await Service.deleteOne({ _id: req.params.id });
            // Its photo goes too, unless the catalog or another record uses it.
            if (service.image) releaseServiceImage(service.image, { excludeServiceId: service._id });
            res.json({ message: 'Service removed' });
        } else {
            res.status(404).json({ message: 'Service not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new combo offer
// @route   POST /api/services/combos
// @access  Private (Provider)
const createCombo = async (req, res) => {
    const { name, description, services, price, image } = req.body;

    try {
        const combo = await Combo.create({
            providerId: req.user._id,
            name,
            description,
            services,
            price,
            image
        });

        if (combo) {
            res.status(201).json(combo);
        } else {
            res.status(400).json({ message: 'Invalid combo data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a combo
// @route   PUT /api/services/combos/:id
// @access  Private (Provider)
const updateCombo = async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.id);

        if (combo) {
            if (combo.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            combo.name = req.body.name || combo.name;
            combo.description = req.body.description || combo.description;
            combo.services = req.body.services || combo.services;
            combo.price = req.body.price || combo.price;
            combo.isActive = req.body.isActive !== undefined ? req.body.isActive : combo.isActive;
            combo.image = req.body.image || combo.image;

            const updatedCombo = await combo.save();
            res.json(updatedCombo);
        } else {
            res.status(404).json({ message: 'Combo not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a combo
// @route   DELETE /api/services/combos/:id
// @access  Private (Provider)
const deleteCombo = async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.id);

        if (combo) {
            if (combo.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            await Combo.deleteOne({ _id: req.params.id });
            res.json({ message: 'Combo removed' });
        } else {
            res.status(404).json({ message: 'Combo not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    categoryCatalogFor,
    getMyServices,
    createService,
    updateService,
    deleteService,
    createCombo,
    updateCombo,
    deleteCombo
};
