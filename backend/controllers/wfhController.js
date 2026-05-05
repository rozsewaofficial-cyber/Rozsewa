const Provider = require('../models/Provider');

// @desc    Get all pending vendors for WFH verification
// @route   GET /api/wfh/pending-vendors
// @access  Private/WFH
const getPendingVendors = async (req, res) => {
    try {
        const vendors = await Provider.find({ 
            status: 'pending',
            isWFHVerified: false 
        }).sort({ createdAt: -1 });
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify vendor details (WFH level)
// @route   PUT /api/wfh/verify-vendor/:id
// @access  Private/WFH
const verifyVendor = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        provider.isWFHVerified = true;
        provider.wfhVerifiedBy = req.user._id;
        
        // Optionally, if WFH is the final authority, we can set status to verified
        // But usually, WFH just marks it as 'WFH Verified' and Admin does final check
        // The user says "WFH -> Vendor verify karegi", so I'll set status to verified
        provider.status = 'verified';
        provider.kycVerified = true;

        const updatedProvider = await provider.save();
        res.json({
            message: 'Vendor verified successfully by WFH',
            provider: updatedProvider
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPendingVendors,
    verifyVendor
};
