const Category = require('../models/Category');

// @desc    Get all active categories
// @route   GET /api/categories
// @access  Public
const getPublicCategories = async (req, res) => {
    try {
        let categories = await Category.find({ isActive: true }).sort({ index: 1 });
        const { providerType } = req.query;
        if (providerType === 'sewak' || providerType === 'partner') {
            categories = categories.filter(c => !c.visibleTo || c.visibleTo === 'both' || c.visibleTo === providerType);
        }
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getPublicCategories };
