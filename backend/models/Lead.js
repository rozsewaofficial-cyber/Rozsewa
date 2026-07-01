const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    service: {
        type: String,
        required: true
    },
    requirementForm: {
        description: { type: String, required: true },
        preferredDate: { type: String, required: true },
        preferredTime: { type: String, required: true },
        images: [{ type: String }],
        address: { type: String }
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    leadPrice: {
        type: Number,
        required: true,
        default: 0
    },
    businessModel: {
        type: String,
        enum: ['lead'],
        default: 'lead'
    },
    nearbyProviders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    }],
    unlockedProviders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    }],
    maxUnlockLimit: {
        type: Number,
        required: true,
        default: 3
    },
    expiry: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'available', 'unlocked', 'completed', 'cancelled', 'expired', 'disputed', 'closed'],
        default: 'pending'
    },
    disputeStatus: {
        type: String,
        enum: ['none', 'pending', 'refunded', 'rejected'],
        default: 'none'
    }
}, {
    timestamps: true
});

// Spatial index for geolocation searches
leadSchema.index({ location: '2dsphere' });
leadSchema.index({ category: 1, status: 1 });
leadSchema.index({ createdAt: 1 });
leadSchema.index({ expiry: 1 });

const Lead = mongoose.model('Lead', leadSchema);
module.exports = Lead;
