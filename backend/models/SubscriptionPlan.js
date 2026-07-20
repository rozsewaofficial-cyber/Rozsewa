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
        required: false 
    },
    providerCategory: {
        type: String,
        enum: ['all', 'partner', 'sewak'],
        default: 'all'
    },
    offeredCommissionRate: { type: Number, required: false },
    offeredCommissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    commissionRate: { type: Number }, // alias/new field
    duration: { type: Number, default: 365 }, // duration in days
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    benefits: [
        {
            key: { type: String, required: true },
            value: { type: mongoose.Schema.Types.Mixed, required: true }
        }
    ],
    description: { type: String },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    leadCredits: { type: Number, default: 0 },
    validity: { type: Number, default: 365 },
    settlementType: { type: String, enum: ['weekly', 'daily', '24_hours', 'monday'], default: 'monday' },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
module.exports = SubscriptionPlan;
