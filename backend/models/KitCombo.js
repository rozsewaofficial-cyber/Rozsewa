const mongoose = require('mongoose');

/**
 * A Combo Pack — a bundle of StarterKitItems sold at a custom total price.
 *
 * Named KitCombo, not Combo: the existing `Combo` model is provider-created
 * SERVICE bundles with its own approval workflow. They share a word, nothing else.
 *
 * Note there is no quantity stored per item — quantity is inherited live from
 * StarterKitItem.kitQuantity, per the SRS. Order lines freeze it at order time.
 */
const kitComboSchema = mongoose.Schema({
    name: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },

    items: [
        {
            itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StarterKitItem', required: true },
            _id: false
        }
    ],

    // Admin's own total for the pack — intentionally independent of the sum of item prices.
    comboPrice: { type: Number, required: true, min: 0 },

    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

kitComboSchema.index({ categoryId: 1, isActive: 1 });

module.exports = mongoose.model('KitCombo', kitComboSchema);
