const mongoose = require('mongoose');

// Dedicated audit-log-style ledger for customer tips — kept separate from
// Booking/commission math entirely. 100% of a tip always goes to the
// executing party; RozSewa never deducts anything from it.
const tipSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    // Set when a Partner's own staff (not the Partner directly) did the job.
    // The payout still lands in the Partner's wallet (see verifyTip) — there is
    // no separate staff-level wallet in the system yet — but this preserves who
    // it was actually for.
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    professionalType: {
        type: String,
        enum: ['partner', 'sewak', 'staff'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'credited', 'failed'],
        default: 'pending'
    },
    triggerPoint: {
        type: String,
        enum: ['payment_screen', 'post_payment'],
        required: true
    }
}, {
    timestamps: true
});

tipSchema.index({ bookingId: 1, createdAt: -1 });
tipSchema.index({ providerId: 1, createdAt: -1 });

module.exports = mongoose.model('Tip', tipSchema);
