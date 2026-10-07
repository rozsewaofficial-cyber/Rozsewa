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
    // locationValue reduced by BannerService.normalizePlace — what customer
    // locations are compared against, without building a regex from input.
    locationKey: { type: String },
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
        // 'Approved' is kept only for older rows; approval now goes straight to
        // Active. 'Stopped' is an admin ending a running banner early.
        enum: ['Pending Approval', 'Banner Design Required', 'Approved', 'Active', 'Expired', 'Rejected', 'Stopped'],
        default: 'Pending Approval'
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    // What the partner paid in total (GST included), computed on the server
    // from the plan and duration — never taken from the request.
    pricePaid: {
        type: Number,
        required: true,
        min: 0
    },
    basePrice: { type: Number, min: 0 },
    gstAmount: { type: Number, min: 0 },
    paidVia: { type: String, enum: ['razorpay', 'wallet'] },
    // Razorpay payment id, or WALLET_<transaction id>. Unique, so one payment
    // can never buy two banners.
    paymentId: {
        type: String,
        unique: true,
        sparse: true
    },
    rejectionReason: { type: String },
    refund: {
        // 'manual': an older request whose payment could not be verified —
        // rejected, and left for a person to refund after checking Razorpay.
        status: { type: String, enum: ['none', 'refunded', 'manual'], default: 'none' },
        amount: { type: Number },
        at: { type: Date },
        transactionId: { type: mongoose.Schema.Types.ObjectId }
    },
    // Set when the "expires in 3 days" reminder goes out, so it goes once.
    reminderSentAt: { type: Date },
    stoppedAt: { type: Date },
    analytics: {
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        orders: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

providerBannerSchema.index({ status: 1, endDate: 1 });
providerBannerSchema.index({ provider: 1, createdAt: -1 });

module.exports = mongoose.model('ProviderBanner', providerBannerSchema);
