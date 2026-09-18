const InstaService = require('../models/InstaService');
const InstaJob = require('../models/InstaJob');
const Provider = require('../models/Provider');
const InstaConfig = require('../services/InstaConfigService');
const Pricing = require('../services/InstaPricingService');
const AuditLog = require('../models/AuditLog');

const logAction = async (req, actionType, entityId, entityName, details = {}) => {
    try {
        await AuditLog.create({
            actionType,
            entityType: 'INSTA_WORK',
            entityId,
            entityName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || 'Admin',
            verifiedByRole: req.user.role || 'admin',
            details
        });
    } catch (err) {
        console.error('[InstaWork] Audit log failed:', err.message);
    }
};

/* ------------------------------- config ------------------------------- */

// @route   GET /api/admin/insta/config
const getConfig = async (req, res) => {
    try {
        res.json(await InstaConfig.getConfig());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @route   PUT /api/admin/insta/config
const updateConfig = async (req, res) => {
    try {
        const before = await InstaConfig.getConfig();
        const saved = await InstaConfig.saveConfig(req.body || {});
        await logAction(req, 'INSTA_CONFIG_UPDATED', req.user._id, 'Insta Work configuration', { before, after: saved });
        res.json({ message: 'Insta Work settings saved.', config: saved });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/* --------------------------- service master --------------------------- */

// @route   GET /api/admin/insta/services
const getServices = async (req, res) => {
    try {
        const services = await InstaService.find().sort({ createdAt: -1 }).lean();
        res.json({
            services: services.map(s => ({ ...s, unitLabel: Pricing.UNIT_LABELS[s.pricingType] })),
            pricingTypes: Pricing.PRICING_TYPES.map(t => ({ value: t, label: Pricing.UNIT_LABELS[t] }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** Shared validation for create and update. */
const validateServicePayload = (body) => {
    const {
        name, pricingType, sewakRate, minRate, maxRate,
        baseChargeEnabled, baseCharge, minQuantity, maxQuantity, availableFor
    } = body;

    if (!name || !String(name).trim()) throw new Error('Service name is required.');
    if (!Pricing.PRICING_TYPES.includes(pricingType)) throw new Error('Choose a valid pricing type.');

    const models = Array.isArray(availableFor) && availableFor.length ? availableFor : ['sewak', 'partner'];
    if (models.some(m => !['sewak', 'partner'].includes(m))) throw new Error('Invalid supply model.');

    const min = Number(minRate) || 0;
    const max = Number(maxRate) || 0;
    // A band that cannot be satisfied would let a Partner select the service
    // and then never be able to save a rate for it.
    if (models.includes('partner')) {
        if (min <= 0 || max <= 0) throw new Error('Partner services need a minimum and maximum rate.');
        if (max < min) throw new Error('Maximum rate cannot be below the minimum rate.');
    }
    if (models.includes('sewak') && (Number(sewakRate) || 0) <= 0) {
        throw new Error('Sewak services need an admin-defined rate.');
    }
    if (baseChargeEnabled && (Number(baseCharge) || 0) <= 0) {
        throw new Error('Enter a base charge, or switch the base charge off.');
    }

    const minQ = Number(minQuantity);
    const maxQ = Number(maxQuantity);
    if (pricingType !== 'custom') {
        if (!Number.isFinite(minQ) || minQ <= 0) throw new Error('Minimum quantity must be greater than zero.');
        if (!Number.isFinite(maxQ) || maxQ < minQ) throw new Error('Maximum quantity must be at least the minimum.');
    }

    return {
        name: String(name).trim(),
        description: body.description || '',
        icon: body.icon || 'Zap',
        categoryId: body.categoryId || null,
        categoryName: body.categoryName || '',
        pricingType,
        sewakRate: Number(sewakRate) || 0,
        minRate: min,
        maxRate: max,
        baseChargeEnabled: !!baseChargeEnabled,
        baseCharge: Number(baseCharge) || 0,
        minQuantity: pricingType === 'custom' ? 1 : minQ,
        maxQuantity: pricingType === 'custom' ? 1 : maxQ,
        availableFor: models,
        cities: Array.isArray(body.cities) ? body.cities : [],
        isActive: body.isActive !== undefined ? !!body.isActive : true
    };
};

// @route   POST /api/admin/insta/services
const createService = async (req, res) => {
    try {
        const fields = validateServicePayload(req.body);
        const service = await InstaService.create({ ...fields, createdBy: req.user._id });
        await logAction(req, 'INSTA_SERVICE_CREATED', service._id, service.name, {
            pricingType: service.pricingType, sewakRate: service.sewakRate,
            minRate: service.minRate, maxRate: service.maxRate
        });
        res.status(201).json({ message: 'Insta service created.', service });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @route   PUT /api/admin/insta/services/:id
const updateService = async (req, res) => {
    try {
        const service = await InstaService.findById(req.params.id);
        if (!service) return res.status(404).json({ message: 'Service not found.' });

        const fields = validateServicePayload({ ...service.toObject(), ...req.body });
        Object.assign(service, fields);
        await service.save();

        await logAction(req, 'INSTA_SERVICE_UPDATED', service._id, service.name, { fields });
        res.json({ message: 'Insta service updated.', service });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @route   PATCH /api/admin/insta/services/:id/status
const toggleServiceStatus = async (req, res) => {
    try {
        const service = await InstaService.findById(req.params.id);
        if (!service) return res.status(404).json({ message: 'Service not found.' });

        service.isActive = req.body.isActive !== undefined ? !!req.body.isActive : !service.isActive;
        await service.save();
        await logAction(req, service.isActive ? 'INSTA_SERVICE_ACTIVATED' : 'INSTA_SERVICE_DEACTIVATED',
            service._id, service.name, { isActive: service.isActive });

        res.json({ message: service.isActive ? 'Service activated.' : 'Service deactivated.', service });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @route   DELETE /api/admin/insta/services/:id
const deleteService = async (req, res) => {
    try {
        const service = await InstaService.findById(req.params.id);
        if (!service) return res.status(404).json({ message: 'Service not found.' });

        // Removing a service that jobs are running on would strand them, so
        // deactivation is offered instead of a destructive delete.
        const live = await InstaJob.countDocuments({
            serviceId: service._id,
            status: { $nin: ['CLOSED', 'CANCELLED'] }
        });
        if (live > 0) {
            return res.status(409).json({
                message: `${live} job(s) are still running on "${service.name}". Deactivate it instead of deleting.`
            });
        }

        await logAction(req, 'INSTA_SERVICE_DELETED', service._id, service.name, {});
        await service.deleteOne();
        res.json({ message: 'Insta service removed.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ------------------------------ monitoring ------------------------------ */

// @route   GET /api/admin/insta/jobs
const getJobs = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.supplyModel) query.supplyModel = req.query.supplyModel;

        const [jobs, total] = await Promise.all([
            InstaJob.find(query)
                .populate('customerId', 'name mobile')
                .populate('providerId', 'ownerName shopName mobile providerCategory')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            InstaJob.countDocuments(query)
        ]);

        res.json({ jobs, total, page, pages: Math.ceil(total / limit) || 1 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @route   GET /api/admin/insta/stats
const getStats = async (req, res) => {
    try {
        // "Online" has to mean what matching means by it, or the number is
        // worse than none: it counted everyone with the toggle on, including
        // workers whose app had been shut for days, workers an admin had
        // disabled, and workers serving a cancellation restriction. An admin
        // reading "20 online" while customers were told nobody was available
        // had no way to reconcile the two.
        const config = await InstaConfig.getConfig();
        const now = new Date();
        const freshSince = new Date(now.getTime() - Math.max(1, Number(config.pingFreshnessMinutes) || 5) * 60000);
        const availableNow = {
            'instaWork.enabled': true,
            'instaWork.disabledByAdmin': { $ne: true },
            'instaWork.lastPingAt': { $gte: freshSince },
            $or: [
                { 'instaWork.restrictedUntil': null },
                { 'instaWork.restrictedUntil': { $exists: false } },
                { 'instaWork.restrictedUntil': { $lte: now } }
            ]
        };

        const [byStatus, live, toggledOn, totals] = await Promise.all([
            InstaJob.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
            Provider.countDocuments(availableNow),
            // Kept alongside, because "12 of 40 have it switched on" is a
            // different and also useful thing to know.
            Provider.countDocuments({ 'instaWork.enabled': true }),
            InstaJob.aggregate([
                { $match: { status: 'CLOSED' } },
                {
                    $group: {
                        _id: null,
                        jobs: { $sum: 1 },
                        revenue: { $sum: '$finalAmount' },
                        commission: { $sum: '$adminCommission' }
                    }
                }
            ])
        ]);

        res.json({
            byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r._id]: r.n }), {}),
            workersOnline: live,
            workersEnabled: toggledOn,
            completedJobs: totals[0]?.jobs || 0,
            revenue: totals[0]?.revenue || 0,
            commission: totals[0]?.commission || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Lift or apply an Insta Work restriction on a worker
// @route   PATCH /api/admin/insta/providers/:id/restriction
const setProviderRestriction = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: 'Provider not found.' });

        const { disabled, clearRestriction, resetCancelCount } = req.body;
        if (disabled !== undefined) {
            provider.instaWork.disabledByAdmin = !!disabled;
            if (disabled) provider.instaWork.enabled = false;
        }
        if (clearRestriction) provider.instaWork.restrictedUntil = null;
        if (resetCancelCount) provider.instaWork.cancelCount = 0;
        await provider.save();

        await logAction(req, 'INSTA_PROVIDER_RESTRICTION', provider._id,
            provider.ownerName || provider.shopName, { disabled, clearRestriction, resetCancelCount });

        res.json({ message: 'Worker Insta Work access updated.', instaWork: provider.instaWork });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getConfig,
    updateConfig,
    getServices,
    createService,
    updateService,
    toggleServiceStatus,
    deleteService,
    getJobs,
    getStats,
    setProviderRestriction
};
