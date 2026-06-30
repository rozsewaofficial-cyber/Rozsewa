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
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending',
    },
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
            amount: { type: Number }
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
}, {
    timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
