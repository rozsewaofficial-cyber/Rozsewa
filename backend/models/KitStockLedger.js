const mongoose = require('mongoose');

/**
 * One row per manual restock or correction on a StarterKitItem. adjustStock()
 * used to only console.log the change, so "when was this item last restocked,
 * and by how much" had no answer once the process restarted. Rows are never
 * edited; a mistake is corrected by writing a new row, the same convention
 * CoinLedger uses.
 *
 * Stock moved by an order (confirm/cancel) is not logged here — a KitOrder
 * already carries its own dated trail (confirmedAt, cancelledAt) of exactly
 * what it deducted or restored.
 */
const kitStockLedgerSchema = new mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StarterKitItem', required: true, index: true },
    itemName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    delta: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },

    reason: { type: String, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' }
}, {
    timestamps: true
});

kitStockLedgerSchema.index({ createdAt: -1 });
kitStockLedgerSchema.index({ categoryId: 1, createdAt: -1 });

module.exports = mongoose.model('KitStockLedger', kitStockLedgerSchema);
