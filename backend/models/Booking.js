const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: false,
    },
    requiredProviderCategory: {
        type: String,
        enum: ['partner', 'sewak'],
        default: 'partner'
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: false,
    },
    serviceName: {
        type: String,
        required: true,
    },
    serviceId: {
        type: String,
        required: true,
    },
    bookingDate: {
        type: String,
        required: true,
    },
    bookingTime: {
        type: String,
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    baseServiceAmount: {
        type: Number,
        default: 0
    },
    gstAmount: {
        type: Number,
        default: 0
    },
    platformFee: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'on_the_way', 'started', 'completed', 'cancelled'],
        default: 'pending',
    },
    cancellationReason: {
        type: String,
        default: null
    },
    cancelledBy: {
        type: String,
        enum: ['user', 'provider', 'admin', null],
        default: null
    },
    startOTP: {
        type: String,
        default: null
    },
    endOTP: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
    },
    // Operational collection status — separate from financial paymentStatus
    collectionStatus: {
        type: String,
        enum: ['not_collected', 'cash_collected', 'online_verified', 'staff_verified'],
        default: 'not_collected'
    },
    paymentCollectedBy: {
        type: String,
        enum: ['partner_cash', 'staff_verified', 'razorpay_auto', 'admin', null],
        default: null
    },
    paymentCollectedAt: { type: Date, default: null },
    // Unauthorized payment attempt tracking
    unauthorizedPaymentFlag:  { type: Boolean, default: false },
    unauthorizedPaymentNote:  { type: String,  default: null  },
    unauthorizedPaymentAt:    { type: Date,    default: null  },
    unauthorizedAttemptedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', default: null },
    address: {
        type: String,
        required: true,
    },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number], // [longitude, latitude]
    },
    rating: {
        type: Number,
        default: 0,
    },
    comment: {
        type: String,
        default: '',
    },
    providerReply: {
        type: String,
        default: '',
    },
    providerReplyDate: {
        type: Date,
    },
    tags: {
        type: [String],
        default: [],
    },
    couponCode: {
        type: String,
        default: ''
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    customerOffer: {
        type: Number,
        default: null
    },
    originalFixedPrice: {
        type: Number,
        default: null
    },
    offerStatus: {
        type: String,
        enum: ['pending', 'accepted', 'rejected_fixed_price', 'countered', 'counter_accepted', 'counter_rejected', 'counter_expired'],
        default: 'pending'
    },
    partnerCounterOffer: {
        type: Number,
        default: null
    },
    acceptedPrice: {
        type: Number,
        default: null
    },
    counterOfferExpiresAt: {
        type: Date,
        default: null
    },
    pricingDecision: {
        type: String,
        enum: ['fixed_price', 'customer_offer', 'partner_counter_offer'],
        default: null
    },
    bargainDiscount: {
        type: Number,
        default: 0
    },
    couponDiscount: {
        type: Number,
        default: 0
    },
    // ── RozSewa Coins redemption ─────────────────────────────────────────
    // The hold that paid for part of this booking. Kept so the coins can be
    // committed on completion and refunded on cancellation.
    coinRedemptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CoinRedemption',
        default: null
    },
    coinsRedeemed: {
        type: Number,
        default: 0
    },
    coinDiscount: {
        type: Number,
        default: 0
    },
    totalDiscount: {
        type: Number,
        default: 0
    },
    paymentMode: {
        type: String,
        enum: ['now', 'after'],
        default: 'now'
    },
    beforeImage: { type: String, default: null },
    afterImage: { type: String, default: null },
    extraCharges: [
        {
            item: { type: String },
            amount: { type: Number },
            status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'approved' }
        }
    ],
    travelCharge: {
        distanceKm: { type: Number },
        billableDistanceKm: { type: Number },
        baseDistance: { type: Number },
        baseFee: { type: Number },
        extraFeePerKm: { type: Number },
        amount: { type: Number },
        calculationMethod: { type: String, default: 'haversine' },
        calculatedAt: { type: Date },
        status: { type: String, enum: ['estimated', 'final', 'fallback'], default: 'estimated' }
    },
    extraStatus: {
        type: String,
        enum: ['none', 'pending', 'approved', 'declined'],
        default: 'none'
    },
    adminCommission: { type: Number, default: 0 },
    providerPayout: { type: Number, default: 0 },
    employeeCommission: { type: Number, default: 0 },
    commissionStatus: { type: String, default: 'free' },
    transactionId: { type: String, unique: true, sparse: true },
    commissionTransactionId: { type: String, unique: true, sparse: true },
    commissionSnapshot: {
        partnerProgramVersion: { type: Number },
        commissionRuleId: { type: String },
        commissionRuleName: { type: String },
        commissionSource: { type: String },
        providerOverrideUsed: { type: Boolean, default: false },
        waiverApplied: { type: Boolean, default: false },
        bookingCategorySnapshot: {
            id: { type: mongoose.Schema.Types.ObjectId },
            name: { type: String },
            nightChargePercent: { type: Number }
        },
        providerSnapshot: {
            id: { type: mongoose.Schema.Types.ObjectId },
            ownerName: { type: String },
            shopName: { type: String }
        },
        subscriptionSnapshot: {
            planId: { type: mongoose.Schema.Types.ObjectId },
            planName: { type: String },
            planPrice: { type: Number },
            benefits: [{ key: String, value: mongoose.Schema.Types.Mixed }]
        },
        commissionPercentage: { type: Number },
        commissionAmount: { type: Number },
        providerEarnings: { type: Number },
        platformEarnings: { type: Number },
        // The order's value BEFORE any platform-funded coin discount. This is
        // what commission and payout are computed on, so the partner is paid
        // the same whether or not the customer spent coins.
        grossOrderAmount: { type: Number },
        // The coin discount RozSewa funded on this booking (marketing cost).
        coinSubsidy: { type: Number, default: 0 },
        // What the platform actually kept once the subsidy is netted off.
        // Goes negative when a discount exceeds the commission earned.
        netPlatformEarnings: { type: Number },
        calculatedAt: { type: Date }
    },
    adminRequest: {
        status: { type: String, enum: ['none', 'pending', 'resolved'], default: 'none' },
        reason: { type: String, default: '' },
        requestedAt: { type: Date, default: null }
    },
    negotiation: {
        userProposedAmount: { type: Number, default: null },
        providerCounterAmount: { type: Number, default: null },
        status: { type: String, enum: ['none', 'user_proposed', 'provider_countered', 'accepted', 'rejected'], default: 'none' }
    },
    proposedSchedule: {
        providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', default: null },
        date: { type: String, default: null },
        time: { type: String, default: null },
        message: { type: String, default: null },
        status: { type: String, enum: ['none', 'pending', 'accepted', 'rejected'], default: 'none' }
    },
    acceptedAt: { type: Date, default: null },
    onTheWayAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    rejectedProviders: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Provider'
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    serviceLocation: {
        type: String,
        enum: ['home', 'shop'],
        default: 'home'
    }
}, {
    timestamps: true
});

/**
 * RozSewa Coins reversal on cancellation / refund.
 *
 * A booking can be cancelled from a lot of places — the customer, the partner,
 * an admin, an expired counter-offer, the socket reject handler — and several
 * of those use findOneAndUpdate rather than save(). Hanging the trigger off the
 * model instead of each call site is what guarantees no path can cancel a
 * booking and silently keep the customer's coins.
 *
 * The handler is idempotent and never throws, so a double-fire is harmless.
 */
const fireCoinReversal = (bookingId, reason) => {
    if (!bookingId) return;
    setImmediate(async () => {
        try {
            const CoinRewardService = require('../services/CoinRewardService');
            await CoinRewardService.onBookingReversed(bookingId, reason);
        } catch (err) {
            console.error('[Coins] Booking reversal hook failed:', err.message);
        }
    });
};

const isReversalState = (status, paymentStatus) =>
    status === 'cancelled' || paymentStatus === 'refunded';

// Promise-style hook (no `next`), matching the convention used elsewhere in
// these models — this Mongoose version does not pass a callback here.
bookingSchema.pre('save', async function () {
    // Recorded in pre-save because modifiedPaths() is cleared by the time the
    // post-save hook runs.
    this.$locals.coinReversal =
        (this.isModified('status') && this.status === 'cancelled') ||
        (this.isModified('paymentStatus') && this.paymentStatus === 'refunded');
});

bookingSchema.post('save', function (doc) {
    if (this.$locals && this.$locals.coinReversal) {
        fireCoinReversal(doc._id, doc.status === 'cancelled' ? 'Booking cancelled' : 'Booking refunded');
    }
});

// Query-middleware equivalent, for the paths that update without loading a doc.
bookingSchema.post(['findOneAndUpdate', 'updateOne'], function (result) {
    const update = this.getUpdate() || {};
    const fields = { ...(update.$set || {}), ...update };
    if (isReversalState(fields.status, fields.paymentStatus)) {
        const id = (result && result._id) || (this.getQuery() || {})._id;
        fireCoinReversal(id, fields.status === 'cancelled' ? 'Booking cancelled' : 'Booking refunded');
    }
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
