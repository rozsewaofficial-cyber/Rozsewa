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
        provider.kycVerified = true;

        // Sewaks additionally need the Training Panel (kit items verified + basic
        // training) before going live — otherwise this route would be a side door
        // around that gate. Partners are unaffected. See TRAINING_PANEL_PLAN.md D2.
        let trainingBlocked = false;
        if (provider.providerCategory === 'sewak') {
            try {
                const TrainingRecord = require('../models/TrainingRecord');
                const record = await TrainingRecord.findOne({ sewakId: provider._id });
                trainingBlocked = !(record && record.trainingCompleted);
                if (!record) {
                    const { ensureRecord } = require('./trainingPanelController');
                    await ensureRecord(provider);
                }
            } catch (err) {
                console.error('[TrainingGate/WFH] check failed, allowing go-live:', err.message);
                trainingBlocked = false;
            }
        }

        provider.status = trainingBlocked ? 'pending' : 'verified';
        if (trainingBlocked) provider.isOnline = false;

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
