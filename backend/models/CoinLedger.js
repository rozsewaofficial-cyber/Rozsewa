const mongoose = require('mongoose');

/**
 * Immutable coin ledger (§14). Every balance change in the system writes
 * exactly one row here, carrying the before/after balance so the wallet can be
 * fully reconstructed and audited from the ledger alone.
 *
 * Rows are never updated or deleted. A mistake is corrected by writing a
 * compensating REVERSAL row, never by editing history.
 */
const SOURCES = [
    'REFERRAL_REWARD',
    'FIRST_ORDER',
    'TARGET_ACHIEVEMENT',
    'ORDER_DISCOUNT',
    'SUB_DISCOUNT',
    'CLAWBACK',
    'REFUND',
    'EXPIRY',
    'ADMIN_ADJUSTMENT'
];

const coinLedgerSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    walletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CoinWallet',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    ownerType: {
        type: String,
        enum: ['customer', 'partner', 'sewak'],
        required: true
    },
    type: {
        type: String,
        enum: ['CREDIT', 'DEBIT', 'REVERSAL', 'EXPIRY'],
        required: true
    },
    coins: {
        type: Number,
        required: true
    },
    // Rupee value at the moment of the transaction, using the ratio in force
    // then. Stored rather than derived so a later ratio change doesn't rewrite
    // what the user was actually shown.
    monetaryValue: {
        type: Number,
        required: true
    },
    conversionRatio: {
        type: Number,
        required: true
    },
    source: {
        type: String,
        enum: SOURCES,
        required: true
    },
    // The booking / subscription / referred-user this row is attributable to.
    // Together with (ownerId, source) this is what makes reward crediting
    // idempotent — see the unique index below.
    referenceId: {
        type: String,
        default: null
    },
    referenceModel: {
        type: String,
        enum: ['Booking', 'ProviderSubscription', 'User', 'CoinRedemption', 'CoinLot', null],
        default: null
    },
    previousBalance: { type: Number, required: true },
    newBalance: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'released'],
        default: 'completed'
    },
    description: { type: String, default: '' },
    expiryDate: { type: Date, default: null },

    // Set only for ADMIN_ADJUSTMENT rows — the spec makes a reason mandatory
    // for every manual override (§19).
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: null },
    reason: { type: String, default: null },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true
});

coinLedgerSchema.index({ ownerId: 1, createdAt: -1 });
coinLedgerSchema.index({ walletId: 1, createdAt: -1 });

/**
 * The idempotency guarantee for automatic rewards.
 *
 * A reward is uniquely identified by (who, what kind, which reference) — e.g.
 * "TARGET_ACHIEVEMENT for user X at reference target:10". Retried webhooks,
 * double-tapped completions and concurrent workers all collide on this index
 * and the duplicate insert is swallowed by CoinService, so no reward can ever
 * be paid twice. Partial so that rows with no natural reference (admin
 * adjustments, expiry sweeps) are exempt.
 */
coinLedgerSchema.index(
    { ownerId: 1, source: 1, referenceId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            referenceId: { $type: 'string' },
            source: { $in: ['REFERRAL_REWARD', 'FIRST_ORDER', 'TARGET_ACHIEVEMENT'] }
        }
    }
);

module.exports = mongoose.model('CoinLedger', coinLedgerSchema);
module.exports.SOURCES = SOURCES;
