const mongoose = require('mongoose');

const providerBannerSchema = mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    planType: {
        type: String,
        enum: ['Local', 'City', 'District', 'State', 'Premium Top'],
        required: true
    },
    locationValue: {
        type: String,
        required: true
        // For Local -> PIN Code
        // For City -> City Name
        // For Premium Top -> "ALL" or empty
    },
    targetState: { type: String },
    targetDistrict: { type: String },
    targetCity: { type: String },
    targetPincode: { type: String },
    durationDays: {
        type: Number,
        required: true
    },
    bannerSource: {
        type: String,
        enum: ['Upload Own Banner', 'Create Banner by RozSewa'],
        required: true
    },
    designDescription: {
        type: String
    },
    imageUrl: {
        type: String
    },
    status: {
        type: String,
        enum: ['Pending Approval', 'Banner Design Required', 'Approved', 'Active', 'Expired', 'Rejected'],
        default: 'Pending Approval'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    pricePaid: {
        type: Number,
        required: true
    },
    paymentId: {
        type: String
    },
    analytics: {
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        orders: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ProviderBanner', providerBannerSchema);
