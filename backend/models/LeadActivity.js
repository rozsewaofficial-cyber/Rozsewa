const mongoose = require('mongoose');

const leadActivitySchema = new mongoose.Schema({
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
        index: true
    },
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    actorRole: {
        type: String,
        enum: ['customer', 'provider', 'admin', 'system'],
        required: true
    },
    event: {
        type: String,
        required: true,
        enum: [
            'LEAD_CREATED',
            'LEAD_DRAFT_SAVED',
            'LEAD_EDITED',
            'LEAD_PUBLISHED',       // moved from draft → available
            'LEAD_VIEWED',          // provider viewed lead detail
            'LEAD_UNLOCKED',
            'LEAD_EDIT_LOCKED',     // triggered on first unlock
            'LEAD_EXPIRED',
            'LEAD_CANCELLED',
            'LEAD_DISPUTED',
            'LEAD_REFUNDED',
            'LEAD_CLOSED',
            'ADMIN_FORM_CREATED',
            'ADMIN_FORM_UPDATED',
            'ADMIN_FORM_PUBLISHED',
            'ADMIN_FORM_ARCHIVED',
            'ADMIN_CONFIG_CHANGED',
            'DISPUTE_RAISED',
            'DISPUTE_RESOLVED'
        ]
    },
    // Flexible detail payload (e.g. { changedFields: [...], providerId: '...', amount: 99 })
    detail: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

leadActivitySchema.index({ leadId: 1, createdAt: -1 });
leadActivitySchema.index({ event: 1, createdAt: -1 });

const LeadActivity = mongoose.model('LeadActivity', leadActivitySchema);
module.exports = LeadActivity;
