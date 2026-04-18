const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const providerSchema = mongoose.Schema({
    ownerName: { type: String, required: true },
    shopName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String },
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
    gst: { type: String },
    kycAadhaar: { type: String },
    kycAadhaarPhoto: { type: String },
    kycAadhaarBackPhoto: { type: String },
    kycPanNumber: { type: String },
    kycPanPhoto: { type: String },
    bankDetails: {
        accountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String },
        accountHolderName: { type: String }
    },
    openingTime: { type: String, default: "09:00 AM" },
    closingTime: { type: String, default: "09:00 PM" },
    status: { type: String, enum: ['pending', 'verified', 'suspended'], default: 'pending' },
    isOnline: { type: Boolean, default: true },
    isEmergencyEnabled: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    referralCode: { type: String },
    employeeCode: { type: String },
    profileImage: { type: String },
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
            id: { type: String }, // 'aadhaar', 'pan', etc.
            url: { type: String },
            status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
            fileName: { type: String },
            uploadedAt: { type: Date, default: Date.now }
        }
    ],
    kycVerified: { type: Boolean, default: false },
    freeServicesLeft: {
        type: Number,
        default: 3
    },
    commissionRate: {
        type: Number,
        default: 10 // Percentage, can be set by admin
    },
    planType: {
        type: String,
        enum: ['standard', 'pro', 'premium'],
        default: 'pro'
    },
    planExpiry: {
        type: Date,
        default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // Default 30 days from now
    },
    joinedDate: { type: Date, default: Date.now }
}, {
    timestamps: true
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
