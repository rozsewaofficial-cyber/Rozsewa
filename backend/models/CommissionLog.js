const mongoose = require('mongoose');

const commissionLogSchema = new mongoose.Schema({
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    appliedRule: { type: String, required: true },
    appliedPercentage: { type: Number, required: true },
    platformEarnings: { type: Number, required: true },
    providerEarnings: { type: Number, required: true },
    calculationTimestamp: { type: Date, default: Date.now },
    triggerEvent: { type: String, required: true } // e.g., 'BOOKING_COMPLETED', 'PREVIEW'
}, { timestamps: true });

commissionLogSchema.index({ booking: 1, provider: 1 });

module.exports = mongoose.model('CommissionLog', commissionLogSchema);
