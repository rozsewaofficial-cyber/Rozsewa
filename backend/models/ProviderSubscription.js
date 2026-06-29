const mongoose = require('mongoose');

const providerSubscriptionSchema = new mongoose.Schema({
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    pricePaid: { type: Number },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' }
}, { timestamps: true });

providerSubscriptionSchema.index({ provider: 1, status: 1, endDate: 1 });

module.exports = mongoose.model('ProviderSubscription', providerSubscriptionSchema);
