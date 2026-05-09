const BenefitPolicy = require('../models/BenefitPolicy');

// @desc    Get all benefit policies
// @route   GET /api/admin/benefit-policies
// @access  Private (Admin)
const getBenefitPolicies = async (req, res) => {
    try {
        const policies = await BenefitPolicy.find({}).sort({ displayOrder: 1 });
        res.json(policies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a benefit policy
// @route   POST /api/admin/benefit-policies
// @access  Private (Admin)
const createBenefitPolicy = async (req, res) => {
    try {
        const policy = await BenefitPolicy.create(req.body);
        res.status(201).json(policy);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a benefit policy
// @route   PUT /api/admin/benefit-policies/:id
// @access  Private (Admin)
const updateBenefitPolicy = async (req, res) => {
    try {
        const policy = await BenefitPolicy.findById(req.params.id);
        if (policy) {
            Object.assign(policy, req.body);
            const updated = await policy.save();
            res.json(updated);
        } else {
            res.status(404).json({ message: 'Policy not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a benefit policy
// @route   DELETE /api/admin/benefit-policies/:id
// @access  Private (Admin)
const deleteBenefitPolicy = async (req, res) => {
    try {
        const policy = await BenefitPolicy.findById(req.params.id);
        if (policy) {
            await policy.deleteOne();
            res.json({ message: 'Policy removed' });
        } else {
            res.status(404).json({ message: 'Policy not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get public benefit policies
// @route   GET /api/public/benefit-policies
// @access  Public
const getPublicBenefitPolicies = async (req, res) => {
    try {
        const policies = await BenefitPolicy.find({ isActive: true }).sort({ displayOrder: 1 });
        res.json(policies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getBenefitPolicies,
    createBenefitPolicy,
    updateBenefitPolicy,
    deleteBenefitPolicy,
    getPublicBenefitPolicies
};
