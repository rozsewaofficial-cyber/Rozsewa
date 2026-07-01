const mongoose = require('mongoose');

const leadDisputeSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true
    },
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    adminDecision: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    refundStatus: {
        type: String,
        enum: ['none', 'refunded', 'rejected'],
        default: 'none'
    }
}, {
    timestamps: true
});

// Ensure a provider can only file one dispute per lead
leadDisputeSchema.index({ lead: 1, provider: 1 }, { unique: true });
leadDisputeSchema.index({ createdAt: -1 });

const LeadDispute = mongoose.model('LeadDispute', leadDisputeSchema);
module.exports = LeadDispute;
