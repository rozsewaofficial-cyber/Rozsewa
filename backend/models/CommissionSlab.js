const mongoose = require('mongoose');

const commissionSlabSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // null = Global Default
    minAmount: { type: Number, required: true },
    maxAmount: { type: Number, required: true }, // e.g. 999999 for open range (+)
    commissionRate: { type: Number, required: true, min: 0, max: 100 }
}, { timestamps: true });

// Create compound index for querying ranges quickly
commissionSlabSchema.index({ category: 1, minAmount: 1, maxAmount: 1 });

module.exports = mongoose.model('CommissionSlab', commissionSlabSchema);
