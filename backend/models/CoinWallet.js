const mongoose = require('mongoose');

/**
 * One coin wallet per principal. `ownerType` is what enforces the role
 * isolation required by the spec (§17): a customer wallet may only ever pay for
 * an order discount, a partner/sewak wallet only for a subscription discount.
 * The type is stamped on the wallet at creation and never changes, so the rule
 * cannot be sidestepped by a request claiming a different role.
 *
 * `balance` is denominated in COINS, never rupees. Monetary value is always
 * derived at read time via the admin-configured conversion ratio so that
 * changing the ratio never silently rewrites history.
 */
const coinWalletSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true
    },
    ownerType: {
        type: String,
        enum: ['customer', 'partner', 'sewak'],
        required: true
    },
    // Which collection ownerId points at — customers live in User, partners and
    // sewaks both live in Provider.
    ownerModel: {
        type: String,
        enum: ['User', 'Provider'],
        required: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    // Lifetime aggregates that back the wallet dashboard (§14). Kept as running
    // counters rather than recomputed from the ledger so the dashboard stays
    // cheap as the ledger grows.
    totalEarned: { type: Number, default: 0 },
    totalUsed: { type: Number, default: 0 },
    totalExpired: { type: Number, default: 0 },
    totalRefunded: { type: Number, default: 0 },
    totalReversed: { type: Number, default: 0 },

    // Admin freeze (§19). A frozen wallet can still receive credits but cannot
    // redeem — freezing is a fraud brake, not a confiscation.
    isFrozen: { type: Boolean, default: false },
    freezeReason: { type: String, default: null },
    frozenAt: { type: Date, default: null },
    frozenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
    timestamps: true
});

coinWalletSchema.index({ ownerType: 1, balance: -1 });

module.exports = mongoose.model('CoinWallet', coinWalletSchema);
