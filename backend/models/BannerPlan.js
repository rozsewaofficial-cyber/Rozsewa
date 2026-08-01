const mongoose = require('mongoose');

const bannerPlanSchema = mongoose.Schema({
    planType: {
        type: String,
        enum: ['Local', 'City', 'District', 'State', 'Premium Top'],
        required: true,
        unique: true
    },
    displayName: { type: String, required: true },
    description: { type: String },
    pricing: [{
        durationDays: { type: Number, required: true }, // e.g. 7, 15, 30
        price: { type: Number, required: true }
    }],
    active: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('BannerPlan', bannerPlanSchema);
