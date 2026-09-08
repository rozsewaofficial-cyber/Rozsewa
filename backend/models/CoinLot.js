const mongoose = require('mongoose');

/**
 * A single batch of credited coins with its own expiry date (§14).
 *
 * Expiry is per-credit, not per-wallet, so the wallet balance alone can't tell
 * us what expires when. Every credit opens a lot; every debit consumes lots in
 * FIFO order by expiryDate (soonest-expiring first) so that coins the user is
 * about to lose are the ones spent first. That ordering is deliberately in the
 * user's favour and is what makes `balance` reconcilable against
 * SUM(remaining) over active lots at any point in time.
 */
const coinLotSchema = new mongoose.Schema({
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CoinWallet',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    // Coins originally credited into this lot — immutable once written.
    coins: {
        type: Number,
        required: true,
        min: 0
    },
    // Coins still unspent in this lot. Drains toward 0 as debits consume it.
    remaining: {
        type: Number,
        required: true,
        min: 0
    },
    source: {
        type: String,
        required: true
    },
    referenceId: {
        type: String,
        default: null
    },
    expiryDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'exhausted', 'expired', 'reversed'],
        default: 'active'
    }
}, {
    timestamps: true
});

// The FIFO consumption query: active lots for a wallet, soonest expiry first.
coinLotSchema.index({ walletId: 1, status: 1, expiryDate: 1 });
// The expiry sweep's query.
coinLotSchema.index({ status: 1, expiryDate: 1 });

module.exports = mongoose.model('CoinLot', coinLotSchema);
