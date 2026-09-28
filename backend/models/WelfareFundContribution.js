const mongoose = require('mongoose');

// Ledger of voluntary contributions into the RozSewa Welfare Fund (Anna Seva /
// Jeev Seva / other approved welfare activities). Per spec, every contribution
// here is purely optional — never an automatic deduction.
const welfareFundContributionSchema = new mongoose.Schema({
    contributorType: {
        type: String,
        enum: ['provider', 'sewak', 'customer', 'rozsewa'],
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    note: {
        type: String,
        default: ''
    },
    // Wallet-debit contributions (the original path) leave these unset.
    // A direct Razorpay gift, or one bundled into a booking's payment, sets
    // them for audit — same convention as Tip.razorpayOrderId/PaymentId.
    paymentMethod: {
        type: String,
        enum: ['wallet', 'razorpay'],
        default: 'wallet'
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    }
}, {
    timestamps: true
});

welfareFundContributionSchema.index({ providerId: 1, createdAt: -1 });
welfareFundContributionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('WelfareFundContribution', welfareFundContributionSchema);
