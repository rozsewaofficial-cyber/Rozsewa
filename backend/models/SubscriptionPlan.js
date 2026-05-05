const mongoose = require('mongoose');

const subscriptionPlanSchema = mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    planType: { 
        type: String, 
        enum: ['monthly', 'yearly'], 
        default: 'yearly' 
    },
    category: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category',
        required: true 
    },
    offeredCommissionRate: { type: Number, required: true },
    offeredCommissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    description: { type: String },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
module.exports = SubscriptionPlan;
