const mongoose = require('mongoose');

const starterKitItemSchema = mongoose.Schema({
    name: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },

    // Company physical stock. Deliberately allowed to go negative — the SRS permits
    // ordering at 0 stock, so confirming those orders drives this below zero as a
    // backorder signal rather than being blocked.
    availableStock: { type: Number, default: 0 },

    // Quantity included per kit, fixed at creation time (e.g. T-Shirt x 2).
    kitQuantity: { type: Number, default: 1, min: 1 },

    price: { type: Number, required: true, min: 0 },
    isMandatory: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 5 }
}, {
    timestamps: true
});

starterKitItemSchema.index({ categoryId: 1, isActive: 1 });

module.exports = mongoose.model('StarterKitItem', starterKitItemSchema);
