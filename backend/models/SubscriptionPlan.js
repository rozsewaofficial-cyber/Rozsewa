const mongoose = require('mongoose');

const subscriptionPlanSchema = mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    validityDays: { type: Number, required: true },
    offeredCommissionRate: { type: Number, required: true },
    offeredCommissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    description: { type: String },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
module.exports = SubscriptionPlan;
