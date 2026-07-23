const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const Service = require('../models/Service');
const mongoose = require('mongoose');

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
            const cat = await Category.findOne({
                name: { $regex: new RegExp(`^${categoryId.trim()}$`, 'i') }
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
        let query = { visible: true, price: { $gt: 0 } };

        if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
            query.subcategoryId = subcategoryId;
        } else {
            const sub = await Subcategory.findOne({
                name: { $regex: new RegExp(`^${subcategoryId.trim()}$`, 'i') }
            });
            if (sub) {
                query.subcategoryId = sub._id;
            } else {
                query.subcategory = subcategoryId;
            }
        }

        const services = await Service.find(query).sort({ createdAt: -1 });
        res.json(services);
    } catch (error) {
        console.error("Error fetching services by subcategory:", error);
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

        const newService = await Service.create({
            name,
            description,
            price: price || 0,
            duration: duration || '30 min',
            visible: visible !== undefined ? visible : true,
            image: image || '',
            subcategoryId: subcategory._id,
            subcategory: subcategory.name,
            categoryId: targetCatId
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
                        description: newService.description || ""
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

        const updated = await service.save();

        if (updated.categoryId) {
            const cat = await Category.findById(updated.categoryId);
            if (cat) {
                const idx = cat.services.findIndex(s => (s._id && s._id.toString() === updated._id.toString()) || s.name === updated.name);
                if (idx !== -1) {
                    cat.services[idx].name = updated.name;
                    cat.services[idx].basePrice = updated.price;
                    cat.services[idx].description = updated.description || "";
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
    getAdminSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createAdminService,
    updateAdminService,
    deleteAdminService
};
