const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const providerSchema = mongoose.Schema({
    ownerName: { type: String, required: true },
    shopName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, set: v => v === "" ? undefined : v },
    businessType: { type: String },
    vendorType: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subServices: [{ type: String }],
    vendorCode: { type: String, unique: true }, // RSVNDxxxxx
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    addresses: [
        {
            label: { type: String },
            address: { type: String },
            icon: { type: String, default: 'home' }
        }
    ],
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    gst: { type: String, unique: true, sparse: true, set: v => v === "" ? undefined : v },
    kycAadhaar: { type: String, unique: true, sparse: true, set: v => v === "" ? undefined : v },
    kycAadhaarPhoto: { type: String },
    kycAadhaarBackPhoto: { type: String },
    kycPanNumber: { type: String, unique: true, sparse: true, set: v => v === "" ? undefined : v },
    kycPanPhoto: { type: String },
    kycPoliceVerification: { type: String, unique: true, sparse: true, set: v => v === "" ? undefined : v },
    bankDetails: {
        accountNumber: { type: String, unique: true, sparse: true, set: v => v === "" ? undefined : v },
        ifscCode: { type: String },
        bankName: { type: String },
        accountHolderName: { type: String }
    },
    openingTime: { type: String, default: "09:00 AM" },
    closingTime: { type: String, default: "09:00 PM" },
    availability: [
        {
            day: { type: String },
            startTime: { type: String, default: "09:00" },
            endTime: { type: String, default: "18:00" },
            isActive: { type: Boolean, default: true }
        }
    ],
    status: { type: String, enum: ['pending', 'verified', 'suspended', 'rejected'], default: 'pending' },
    isOnline: { type: Boolean, default: true },
    isEmergencyEnabled: { type: Boolean, default: false },
    isHomeVisitAvailable: { type: Boolean, default: false },
    is24x7: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    referralCode: { type: String },
    employeeCode: { type: String },
    profileImage: { type: String },
    portfolio: [
        {
            before: { type: String },
            after: { type: String },
            description: { type: String }
        }
    ],
    registrationType: {
        type: String,
        enum: ['individual', 'vendor_referral', 'employee'],
        default: 'individual'
    },
    referredBy: {
        type: String, // Employee ID or Vendor Code
        default: null
    },
    documents: [
        {
            id: { type: String }, // 'aadhaar', 'pan', 'live_video', etc.
            url: { type: String },
            status: { type: String, enum: ['draft', 'pending', 'verified', 'rejected'], default: 'pending' },
            fileName: { type: String },
            uploadedAt: { type: Date, default: Date.now },
            reviewedAt: { type: Date },
            rejectionReason: { type: String },
            adminNotes: { type: String },
            thumbnailUrl: { type: String },
            duration: { type: Number },
            verificationScript: { type: String },
            verificationCode: { type: String },
            scriptVersion: { type: String, default: 'v1' },
            cloudinaryPublicId: { type: String },
            bytes: { type: Number },
            format: { type: String },
            width: { type: Number },
            height: { type: Number }
        }
    ],
    kycSubmitted: { type: Boolean, default: false },
    kycStatus: { type: String, enum: ['draft', 'submitted', 'under_review', 'partially_approved', 'rejected', 'verified'], default: 'draft' },
    kycVerified: { type: Boolean, default: false },
    onboardedByStaff: { type: String }, // Code of field staff who onboarded
    isWFHVerified: { type: Boolean, default: false },
    wfhVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    freeTrial: {
        usedServices: { type: Number, default: 0 },
        extraFreeServices: { type: Number, default: 0 },
        trialStartedAt: { type: Date, default: Date.now },
        trialCompletedAt: { type: Date, default: null }
    },
    commissionOverride: {
        enabled: { type: Boolean, default: false },
        rate: { type: Number, default: 0, min: 0, max: 100 },
        reason: { type: String, default: "" },
        updatedAt: { type: Date }
    },
    commissionWaiver: {
        enabled: { type: Boolean, default: false },
        untilDate: { type: Date, default: null },
        maxBookings: { type: Number, default: null },
        bookingsWaivedCount: { type: Number, default: 0 },
        reason: { type: String, default: "" },
        updatedAt: { type: Date }
    },
    commissionRate: {
        type: Number,
        default: 10 // Percentage, can be set by admin
    },
    planType: {
        type: String,
        enum: ['basic', 'standard', 'premium', 'pro'],
        default: 'basic'
    },
    isSubscribed: {
        type: Boolean,
        default: false
    },
    subscriptionExpiry: {
        type: Date,
        default: null
    },
    subscriptionPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        default: null
    },
    leadCredits: {
        type: Number,
        default: 0
    },
    canReceiveLead: {
        type: Boolean,
        default: true
    },
    leadWalletEnabled: {
        type: Boolean,
        default: true
    },
    minimumWalletEligible: {
        type: Boolean,
        default: true
    },
    providerType: {
        type: String,
        enum: ['commission', 'lead', 'both'],
        default: 'commission'
    },
    subscriptionPurchaseDate: {
        type: Date,
        default: null
    },
    subscriptionPrice: {
        type: Number,
        default: null
    },
    subscriptionRate: {
        type: Number,
        default: null // e.g., 5
    },
    subscriptionType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
    },
    joinedDate: { type: Date, default: Date.now },
    fcmTokens: [String],
    fcmTokenMobile: [String],
    serviceRadius: {
        type: Number,
        default: 15 // km — validated dynamically against admin-configured limits
    },
    providerCategory: {
        type: String,
        enum: ['partner', 'sewak'],
        default: 'partner'
    },
    serviceModes: {
        type: [String],
        enum: ['home', 'shop'],
        default: ['home']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

providerSchema.virtual('freeServicesLeft').get(function() {
    const extra = this.freeTrial?.extraFreeServices || 0;
    const used = this.freeTrial?.usedServices || 0;
    return Math.max(0, 3 + extra - used);
});

// Password comparison
providerSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password before saving
providerSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Create geospatial index for location
providerSchema.index({ location: '2dsphere' });

const Provider = mongoose.model('Provider', providerSchema);
module.exports = Provider;
