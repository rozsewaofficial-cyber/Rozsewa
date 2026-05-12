const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    title: { type: String, required: true },
    type: { type: String, required: true }, // 'Flat Discount', 'Percentage', etc.
    value: { type: String, required: true }, // '₹200 Off', '10%', etc.
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    expiry: { type: Date, required: true },
    reason: { type: String }, // For rejection reason
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);
