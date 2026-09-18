const mongoose = require('mongoose');

/**
 * What a Razorpay order was actually for.
 *
 * Razorpay signs `order_id|payment_id` and nothing else — not the amount, not
 * the purpose, not who paid. So a signature alone proves only that *some*
 * payment against *some* order succeeded. Everything else has to come from
 * here, written when the order was created and never from the request that
 * later claims the payment.
 *
 * The record is also what makes a payment single-use: `consume()` below claims
 * it in one atomic update, so a captured signature cannot be presented twice.
 */
const paymentOrderSchema = mongoose.Schema({
    // Razorpay's order id. Unique, so an order can only ever be recorded once.
    orderId: { type: String, required: true, unique: true, index: true },

    // In rupees, as the order was created. This — never the request body — is
    // what a verified payment is worth.
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    // What the money buys, so a payment for one thing cannot be spent on
    // another.
    purpose: {
        type: String,
        enum: ['booking', 'wallet', 'subscription', 'lead', 'bazaar', 'kit', 'registration', 'other'],
        default: 'other'
    },

    // Who it was created for, where that is known. A public order (provider
    // registration happens before there is an account) leaves these unset.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },

    // For a booking payment, the booking it settles. Verification refuses to
    // mark any other booking paid with it.
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },

    // Set once, when the payment is accepted. Its presence is what makes a
    // second attempt fail.
    consumedBy: { type: String, default: null },
    consumedAt: { type: Date, default: null }
}, { timestamps: true });

/**
 * Claim this order for a payment, once.
 *
 * The match includes `consumedBy: null`, so of two requests arriving together
 * exactly one updates a document and the other gets null back. Returns the
 * order as it was claimed, or null if it was already spent or never existed.
 */
paymentOrderSchema.statics.consume = function (orderId, paymentId) {
    return this.findOneAndUpdate(
        { orderId, consumedBy: null },
        { consumedBy: paymentId, consumedAt: new Date() },
        { new: true }
    );
};

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
