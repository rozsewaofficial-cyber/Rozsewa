const PartnerPolicy = require('../models/PartnerPolicy');

// Get all policies or by category
exports.getPolicies = async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category) {
            query.category = category;
        }
        const policies = await PartnerPolicy.find(query).populate('category', 'name icon type');
        res.status(200).json({ success: true, data: policies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create or update policy for a category
exports.savePolicy = async (req, res) => {
    try {
        const { category, categories, ...policyData } = req.body;
        const targetCategories = categories || (category ? [category] : []);

        if (targetCategories.length === 0) {
            return res.status(400).json({ success: false, message: 'Category is required' });
        }
        
        let savedPolicies = [];
        for (const catId of targetCategories) {
            let policy = await PartnerPolicy.findOne({ category: catId });
            if (policy) {
                policy = await PartnerPolicy.findOneAndUpdate(
                    { category: catId }, 
                    { ...policyData, category: catId }, 
                    { new: true, runValidators: true }
                ).populate('category', 'name icon');
            } else {
                policy = await PartnerPolicy.create({ ...policyData, category: catId });
                policy = await policy.populate('category', 'name icon');
            }
            savedPolicies.push(policy);
        }
        
        res.status(200).json({ success: true, data: savedPolicies.length === 1 ? savedPolicies[0] : savedPolicies });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
