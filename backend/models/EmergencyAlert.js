const mongoose = require('mongoose');

const emergencyAlertSchema = mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    mobile: { type: String, required: true },
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
    address: { type: String },
    status: {
        type: String,
        enum: ['pending', 'resolved', 'ignored'],
        default: 'pending'
    },
    resolvedAt: { type: Date }
}, {
    timestamps: true
});

// emergencyAlertSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
