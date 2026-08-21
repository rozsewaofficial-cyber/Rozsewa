const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const Service = require('../models/Service');
const mongoose = require('mongoose');

const escapeRegex = (str) => {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc    Get active subcategories for a category
// @route   GET /api/public/categories/:categoryId/subcategories
// @access  Public
const getPublicSubcategoriesByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        let query = { isActive: true };

        if (mongoose.Types.ObjectId.isValid(categoryId)) {
            query.categoryId = categoryId;
        } else {
            const cleanCatName = categoryId.trim();
            const cat = await Category.findOne({
                $or: [
                    { name: cleanCatName },
                    { name: { $regex: new RegExp(`^${escapeRegex(cleanCatName)}$`, 'i') } }
                ]
            });
            if (cat) {
                query.categoryId = cat._id;
            } else {
                return res.json([]);
            }
        }

        const subcategories = await Subcategory.find(query).sort({ index: 1, name: 1 });
        res.json(subcategories);
    } catch (error) {
        console.error("Error fetching subcategories:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get services for a subcategory
// @route   GET /api/public/subcategories/:subcategoryId/services
// @access  Public
const getPublicServicesBySubcategory = async (req, res) => {
    try {
        const { subcategoryId } = req.params;
        const { categoryId, category } = req.query;

        // Catalog services are priced at the category/provider level, so virtually
        // all of them carry price 0. Filtering those out by default returned an
        // empty list for every subcategory — which is what pushed this endpoint
        // into its (previously very wrong) category-wide fallback. Zero-priced
        // services are therefore INCLUDED unless a caller explicitly opts out.
        const excludeZeroPrice = req.query.includeZeroPrice === 'false';

        // 1. If requesting "all" services under the category
        if (subcategoryId === 'all' || !subcategoryId) {
            let catObj = null;
            if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
                catObj = await Category.findById(categoryId);
            }
            if (!catObj && category) {
                const cleanCatName = category.trim();
                catObj = await Category.findOne({
                    $or: [
                        { name: cleanCatName },
                        { name: { $regex: new RegExp(`^${escapeRegex(cleanCatName)}$`, 'i') } }
                    ]
                });
            }

            let categoryQuery = { visible: true };
            if (excludeZeroPrice) {
                categoryQuery.price = { $gt: 0 };
            }

            if (catObj) {
                const subDocs = await Subcategory.find({ categoryId: catObj._id });
                const subIds = subDocs.map(s => s._id);
                const subNames = subDocs.map(s => s.name);

                categoryQuery.$or = [
                    { categoryId: catObj._id },
                    { category: catObj.name },
                    { category: { $regex: new RegExp(`^${escapeRegex(catObj.name)}$`, 'i') } },
                    { subcategoryId: { $in: subIds } },
                    { subcategory: { $in: subNames } }
                ];
            } else if (category) {
                const cleanCatName = category.trim();
                categoryQuery.$or = [
                    { category: cleanCatName },
                    { category: { $regex: new RegExp(`^${escapeRegex(cleanCatName)}$`, 'i') } }
                ];
            }

            let services = await Service.find(categoryQuery).sort({ createdAt: -1 });

            // If no individual Service docs found, fallback to Category's pre-defined services array
            if ((!services || services.length === 0) && catObj && catObj.services && catObj.services.length > 0) {
                let fallbackServices = catObj.services;
                if (excludeZeroPrice) {
                    fallbackServices = fallbackServices.filter(s => Number(s.basePrice) > 0);
                }
                services = fallbackServices.map(s => ({
                    _id: s._id || new mongoose.Types.ObjectId(),
                    name: s.name,
                    description: s.description || `Professional ${s.name} service`,
                    price: s.basePrice || 0,
                    duration: "30 min",
                    serviceType: "home",
                    visible: true,
                    category: catObj.name,
                    subcategoryId: s.subcategoryId || null,
                    subcategory: s.subcategory || ""
                }));
            }

            // Collapse duplicates. Every provider offering a service has their own
            // Service doc, so browsing a category returned the same name once per
            // provider plus the catalog copy — 344 rows for 118 real services, each
            // rendering 2-3 times.
            //
            // Keep one row per service name, preferring the copy that carries a
            // subcategoryId (only those group correctly), and surface the lowest
            // non-zero price across the duplicates as the "starting price".
            const collapsed = new Map();
            for (const svc of (services || [])) {
                const s = svc.toObject ? svc.toObject() : svc;
                const key = (s.name || '').trim().toLowerCase();
                if (!key) continue;

                const existing = collapsed.get(key);
                if (!existing) { collapsed.set(key, s); continue; }

                const prefer = (!existing.subcategoryId && s.subcategoryId) ? s : existing;
                const other = prefer === s ? existing : s;

                // Lowest real price wins as the displayed starting price.
                const prices = [Number(prefer.price) || 0, Number(other.price) || 0].filter(p => p > 0);
                prefer.price = prices.length ? Math.min(...prices) : 0;

                // Don't lose tagging/description that only the discarded copy had.
                if (!prefer.subcategoryId && other.subcategoryId) prefer.subcategoryId = other.subcategoryId;
                if (!prefer.subcategory && other.subcategory) prefer.subcategory = other.subcategory;
                if (!prefer.description && other.description) prefer.description = other.description;
                if (!prefer.image && other.image) prefer.image = other.image;

                collapsed.set(key, prefer);
            }

            return res.json([...collapsed.values()]);
        }

        // 2. Specific Subcategory requested
        let subDoc = null;
        if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
            subDoc = await Subcategory.findById(subcategoryId);
        }
        if (!subDoc) {
            const cleanSubName = subcategoryId.trim();
            subDoc = await Subcategory.findOne({
                $or: [
                    { name: cleanSubName },
                    { name: { $regex: new RegExp(`^${escapeRegex(cleanSubName)}$`, 'i') } }
                ]
            });
        }

        let query = { visible: true };
        if (excludeZeroPrice) {
            query.price = { $gt: 0 };
        }

        if (subDoc) {
            query.$or = [
                { subcategoryId: subDoc._id },
                { subcategory: subDoc.name },
                { subcategoryId: subDoc._id.toString() }
            ];
            // Fallback for legacy services that were never tagged with a
            // subcategoryId/subcategory string: match by name, but scope it to
            // the subcategory's own parent category so it can't pull in
            // unrelated services from other categories (e.g. a "Fan" subcategory
            // under Home Appliances matching an unrelated Electrician service).
            const parentCat = await Category.findById(subDoc.categoryId).select('name');
            if (parentCat) {
                query.$or.push({
                    name: { $regex: new RegExp(escapeRegex(subDoc.name), 'i') },
                    $or: [{ categoryId: parentCat._id }, { category: parentCat.name }]
                });
            }
        } else {
            const cleanSub = subcategoryId.trim();
            query.$or = [
                { subcategoryId: cleanSub },
                { subcategory: cleanSub }
            ];
            // Only fall back to a name match when we actually know which
            // category to scope it to — an unscoped name regex would match
            // services from any category in the database.
            let scopeCat = null;
            if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
                scopeCat = await Category.findById(categoryId).select('name');
            } else if (category) {
                scopeCat = await Category.findOne({
                    $or: [
                        { name: category.trim() },
                        { name: { $regex: new RegExp(`^${escapeRegex(category.trim())}$`, 'i') } }
                    ]
                }).select('name');
            }
            if (scopeCat) {
                query.$or.push({
                    name: { $regex: new RegExp(escapeRegex(cleanSub), 'i') },
                    $or: [{ categoryId: scopeCat._id }, { category: scopeCat.name }]
                });
            }
        }

        let services = await Service.find(query).sort({ createdAt: -1 });

        // Fallback: If 0 services found for specific subcategory, check parent Category services
        if ((!services || services.length === 0) && (subDoc || categoryId || category)) {
            let catObj = null;
            if (subDoc) catObj = await Category.findById(subDoc.categoryId);
            if (!catObj && categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
                catObj = await Category.findById(categoryId);
            }
            if (!catObj && category) {
                catObj = await Category.findOne({
                    $or: [
                        { name: category.trim() },
                        { name: { $regex: new RegExp(`^${escapeRegex(category.trim())}$`, 'i') } }
                    ]
                });
            }

            // Only fall back to category-level services when we actually know which
            // subcategory was asked for AND a service name relates to it.
            //
            // Previously this fell back to the ENTIRE category when nothing matched,
            // so e.g. "Beard Services" returned all 125 salon services. An empty
            // subcategory must render empty — never someone else's services.
            if (catObj && catObj.services && catObj.services.length > 0 && subDoc) {
                const subName = subDoc.name.toLowerCase();
                const matchedCatServices = catObj.services.filter(s => {
                    const n = (s.name || '').toLowerCase();
                    return n.includes(subName) || subName.includes(n);
                });

                const priced = excludeZeroPrice
                    ? matchedCatServices.filter(s => Number(s.basePrice) > 0)
                    : matchedCatServices;

                services = priced
                    // An entry with no stable _id can't be selected or booked reliably —
                    // generating a throwaway id per request made it a different service
                    // on every page load.
                    .filter(s => s._id)
                    .map(s => ({
                        _id: s._id,
                        name: s.name,
                        description: s.description || `Professional ${s.name} service`,
                        price: Number(s.basePrice) || 0,
                        duration: "30 min",
                        serviceType: "home",
                        visible: true,
                        category: catObj.name,
                        subcategory: subDoc.name,
                        image: s.image
                    }));
            }
        }

        res.json(services || []);
    } catch (error) {
        console.error("Error fetching services by subcategory:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get services under subcategory for Admin
// @route   GET /api/admin/subcategories/:subcategoryId/services
// @access  Private/Admin
const getAdminServicesBySubcategory = async (req, res) => {
    try {
        const { subcategoryId } = req.params;
        let query = {};
        if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
            query.subcategoryId = subcategoryId;
        } else {
            query.subcategory = subcategoryId;
        }
        const services = await Service.find(query).sort({ createdAt: -1 });
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get subcategories for Admin
// @route   GET /api/admin/subcategories
// @access  Private/Admin
const getAdminSubcategories = async (req, res) => {
    try {
        const { categoryId } = req.query;
        let query = {};
        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
            query.categoryId = categoryId;
        }
        const subcategories = await Subcategory.find(query).populate('categoryId', 'name').sort({ index: 1 });
        res.json(subcategories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create subcategory
// @route   POST /api/admin/subcategories
// @access  Private/Admin
const createSubcategory = async (req, res) => {
    try {
        const { name, categoryId, description, image, icon, isActive, index } = req.body;
        if (!name || !categoryId) {
            return res.status(400).json({ message: 'Name and Category ID are required' });
        }
        const subcategory = await Subcategory.create({
            name,
            categoryId,
            description,
            image,
            icon: icon || 'Wrench',
            isActive: isActive !== undefined ? isActive : true,
            index: index || 0
        });
        res.status(201).json(subcategory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update subcategory
// @route   PUT /api/admin/subcategories/:id
// @access  Private/Admin
const updateSubcategory = async (req, res) => {
    try {
        const subcategory = await Subcategory.findById(req.params.id);
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }

        const { name, categoryId, description, image, icon, isActive, index } = req.body;
        if (name) subcategory.name = name;
        if (categoryId) subcategory.categoryId = categoryId;
        if (description !== undefined) subcategory.description = description;
        if (image !== undefined) subcategory.image = image;
        if (icon !== undefined) subcategory.icon = icon;
        if (isActive !== undefined) subcategory.isActive = isActive;
        if (index !== undefined) subcategory.index = index;

        const updated = await subcategory.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete subcategory
// @route   DELETE /api/admin/subcategories/:id
// @access  Private/Admin
const deleteSubcategory = async (req, res) => {
    try {
        const subcategory = await Subcategory.findById(req.params.id);
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }
        await subcategory.deleteOne();
        await Service.deleteMany({ subcategoryId: req.params.id });
        res.json({ message: 'Subcategory and associated services removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create service under subcategory by Admin
// @route   POST /api/admin/subcategories/:subcategoryId/services
// @access  Private/Admin
const createAdminService = async (req, res) => {
    try {
        const { subcategoryId } = req.params;
        const { name, description, price, duration, visible, image, categoryId } = req.body;

        const subcategory = await Subcategory.findById(subcategoryId);
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }

        const targetCatId = categoryId || subcategory.categoryId;

        const skillFields = {
            skillSessionRequired: !!req.body.skillSessionRequired,
            sessionDurationMinutes: Number(req.body.sessionDurationMinutes) || 60,
            sessionMode: req.body.sessionMode || 'offline',
            skillSessionActive: req.body.skillSessionActive !== false
        };
        const visibleTo = ['sewak', 'partner', 'both'].includes(req.body.visibleTo) ? req.body.visibleTo : 'both';

        const newService = await Service.create({
            name,
            description,
            price: price || 0,
            duration: duration || '30 min',
            visible: visible !== undefined ? visible : true,
            image: image || '',
            subcategoryId: subcategory._id,
            subcategory: subcategory.name,
            categoryId: targetCatId,
            visibleTo,
            ...skillFields
        });

        if (targetCatId) {
            const cat = await Category.findById(targetCatId);
            if (cat) {
                const exists = cat.services.some(s => s.name === name || (s._id && s._id.toString() === newService._id.toString()));
                if (!exists) {
                    cat.services.push({
                        _id: newService._id,
                        name: newService.name,
                        basePrice: newService.price || 0,
                        description: newService.description || "",
                        image: newService.image || "",
                        visibleTo,
                        ...skillFields
                    });
                    await cat.save();
                }
            }
        }

        res.status(201).json(newService);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update service by Admin
// @route   PUT /api/admin/services/:id
// @access  Private/Admin
const updateAdminService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const { name, description, price, duration, visible, image, subcategoryId, categoryId } = req.body;
        if (name) service.name = name;
        if (description !== undefined) service.description = description;
        if (price !== undefined) service.price = price;
        if (duration !== undefined) service.duration = duration;
        if (visible !== undefined) service.visible = visible;
        if (image !== undefined) service.image = image;
        if (subcategoryId) service.subcategoryId = subcategoryId;
        if (categoryId) service.categoryId = categoryId;

        if (req.body.skillSessionRequired !== undefined) service.skillSessionRequired = !!req.body.skillSessionRequired;
        if (req.body.sessionDurationMinutes !== undefined) service.sessionDurationMinutes = Number(req.body.sessionDurationMinutes) || 60;
        if (req.body.sessionMode !== undefined) service.sessionMode = req.body.sessionMode;
        if (req.body.skillSessionActive !== undefined) service.skillSessionActive = !!req.body.skillSessionActive;
        if (['sewak', 'partner', 'both'].includes(req.body.visibleTo)) service.visibleTo = req.body.visibleTo;

        const updated = await service.save();

        if (updated.categoryId) {
            const cat = await Category.findById(updated.categoryId);
            if (cat) {
                const idx = cat.services.findIndex(s => (s._id && s._id.toString() === updated._id.toString()) || s.name === updated.name);
                if (idx !== -1) {
                    cat.services[idx].name = updated.name;
                    cat.services[idx].basePrice = updated.price;
                    cat.services[idx].description = updated.description || "";
                    if (updated.image !== undefined) {
                        cat.services[idx].image = updated.image;
                    }
                    cat.services[idx].skillSessionRequired = updated.skillSessionRequired;
                    cat.services[idx].sessionDurationMinutes = updated.sessionDurationMinutes;
                    cat.services[idx].sessionMode = updated.sessionMode;
                    cat.services[idx].skillSessionActive = updated.skillSessionActive;
                    cat.services[idx].visibleTo = updated.visibleTo;
                    cat.markModified('services');
                    await cat.save();
                }
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete service by Admin
// @route   DELETE /api/admin/services/:id
// @access  Private/Admin
const deleteAdminService = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }
        await service.deleteOne();

        if (service.categoryId) {
            const cat = await Category.findById(service.categoryId);
            if (cat) {
                cat.services = cat.services.filter(s => (s._id && s._id.toString() !== service._id.toString()) && s.name !== service.name);
                cat.markModified('services');
                await cat.save();
            }
        }

        res.json({ message: 'Service removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPublicSubcategoriesByCategory,
    getPublicServicesBySubcategory,
    getAdminServicesBySubcategory,
    getAdminSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createAdminService,
    updateAdminService,
    deleteAdminService
};
