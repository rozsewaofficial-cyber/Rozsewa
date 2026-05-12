const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    actionType: {
        type: String,
        default: "VERIFY",
        required: true
    },
    entityType: {
        type: String,
        enum: ["USER", "SEWAK", "VENDOR", "KYC", "ADMIN"],
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
