const mongoose = require('mongoose');

/**
 * A customer or provider claiming a BenefitPolicy. applicantId's collection
 * varies by applicant, so it uses refPath (the same convention as
 * Notification.recipientId) rather than a fixed ref.
 */
const benefitRequestSchema = new mongoose.Schema({
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'BenefitPolicy', required: true },
    applicantId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'applicantModel' },
    applicantModel: { type: String, required: true, enum: ['User', 'Provider'] },
    applicantRole: { type: String, required: true, enum: ['customer', 'provider'] },
    note: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, default: '' }
}, {
    timestamps: true
});

benefitRequestSchema.index({ applicantId: 1, createdAt: -1 });

module.exports = mongoose.model('BenefitRequest', benefitRequestSchema);
