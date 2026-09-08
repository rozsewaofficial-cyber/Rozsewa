const mongoose = require('mongoose');

const providerSubscriptionSchema = new mongoose.Schema({
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Sticker price of the plan, before any coin discount.
    planPrice: { type: Number },
    // What the provider actually paid through the gateway.
    pricePaid: { type: Number },
    // ── RozSewa Coins redemption ─────────────────────────────────────────
    coinRedemptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoinRedemption', default: null },
    coinsRedeemed: { type: Number, default: 0 },
    coinDiscount: { type: Number, default: 0 },
    creditsRemaining: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' }
}, { timestamps: true });

providerSubscriptionSchema.index({ provider: 1, status: 1, endDate: 1 });

module.exports = mongoose.model('ProviderSubscription', providerSubscriptionSchema);
