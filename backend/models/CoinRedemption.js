const mongoose = require('mongoose');

/**
 * A two-phase hold on coins, which is how §12's "payment fail ho jaye toh Coins
 * final debit nahi hone chahiye" rule is actually enforced.
 *
 *   held      -> coins reserved and removed from the spendable balance, lots
 *                consumed, but the spend is not yet final
 *   committed -> the order/subscription it was created for went through
 *   released  -> payment failed, the user abandoned checkout, or the hold aged
 *                out; coins are returned to their original lots with their
 *                original expiry dates intact
 *
 * Releasing restores the exact lots that were consumed (see lotConsumption),
 * not a fresh lot, so a failed payment cannot be used to launder an
 * about-to-expire balance into a new 90-day one.
 */
const coinRedemptionSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    ownerType: {
        type: String,
        enum: ['customer', 'partner', 'sewak'],
        required: true
    },
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CoinWallet',
        required: true
    },
    // What the hold may be spent on. Enforced against ownerType at creation —
    // 'order' is customer-only, 'subscription' is partner/sewak-only (§17).
    purpose: {
        type: String,
        enum: ['order', 'subscription'],
        required: true
    },
    coins: { type: Number, required: true, min: 1 },
    monetaryValue: { type: Number, required: true },
    conversionRatio: { type: Number, required: true },

    // The gross amount the hold was quoted against. Re-checked at commit time
    // so a hold taken against a ₹1,000 basket can't be spent on a ₹200 one.
    quotedAmount: { type: Number, required: true },

    status: {
        type: String,
        enum: ['held', 'committed', 'released'],
        default: 'held'
    },
    referenceId: { type: String, default: null },
    referenceModel: {
        type: String,
        enum: ['Booking', 'ProviderSubscription', null],
        default: null
    },

    // Exactly which lots this hold drew from, so a release can put every coin
    // back where it came from.
    lotConsumption: [{
        lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoinLot' },
        coins: { type: Number }
    }],

    // Holds self-destruct so abandoned checkouts don't strand a balance.
    expiresAt: { type: Date, required: true },
    releaseReason: { type: String, default: null },
    committedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null }
}, {
    timestamps: true
});

coinRedemptionSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
coinRedemptionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('CoinRedemption', coinRedemptionSchema);
