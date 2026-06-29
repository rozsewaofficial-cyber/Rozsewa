const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    actionType: {
        type: String,
        default: "VERIFY",
        required: true
    },
    entityType: {
        type: String,
        enum: ["USER", "SEWAK", "VENDOR", "KYC", "ADMIN", "COMBO", "BOOKING", "PARTNER_PROGRAM", "COMMISSION_SLAB", "PROVIDER", "SUBSCRIPTION_PLAN", "DISTANCE_CHARGE", "SERVICE_RADIUS_LIMITS"],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    entityName: String,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    verifiedByName: String,
    verifiedByRole: String,
    details: {
        type: Object,
        default: {}
    },
    bonusEarned: {
        type: Number,
        default: 0
    },
    ipAddress: {
        type: String,
        default: ""
    },
    reason: {
        type: String,
        default: ""
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Indexing for faster filtering
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ verifiedBy: 1 });
auditLogSchema.index({ entityType: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
