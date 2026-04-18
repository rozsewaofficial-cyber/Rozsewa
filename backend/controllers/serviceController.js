const Service = require('../models/Service');
const Combo = require('../models/Combo');
const Category = require('../models/Category');
const Provider = require('../models/Provider');

// @desc    Get all services for logged in provider
// @route   GET /api/services
// @access  Private (Provider)
const getMyServices = async (req, res) => {
    try {
        const services = await Service.find({ providerId: req.user._id });
        const combos = await Combo.find({ providerId: req.user._id }).populate('services');

        // Fetch Category Master Services
        const provider = await Provider.findById(req.user._id).populate('vendorType');
        const categoryServices = provider?.vendorType?.services || [];
        const categoryName = provider?.vendorType?.name || 'Your Category';

        res.json({ services, combos, categoryServices, categoryName });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new service
// @route   POST /api/services
// @access  Private (Provider)
const createService = async (req, res) => {
    const { name, description, pricing, duration, category, visible, image } = req.body;

    try {
        const service = await Service.create({
            providerId: req.user._id,
            name,
            description,
            pricing,
            duration,
            category: category || req.user.vendorType,
            visible: visible !== undefined ? visible : true,
            image
        });

        if (service) {
            res.status(201).json(service);
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

            service.name = req.body.name || service.name;
            service.description = req.body.description || service.description;
            service.pricing = req.body.pricing || service.pricing;
            service.duration = req.body.duration || service.duration;
            service.visible = req.body.visible !== undefined ? req.body.visible : service.visible;
            service.image = req.body.image || service.image;

            const updatedService = await service.save();
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
    getMyServices,
    createService,
    updateService,
    deleteService,
    createCombo,
    updateCombo,
    deleteCombo
};
