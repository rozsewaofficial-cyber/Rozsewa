const mongoose = require('mongoose');

/**
 * PaymentAudit — immutable log of every payment-related action.
 * Every payment state change (collection, verification, unauthorized attempt,
 * flag clearance, admin override) must create a record here before any
 * state is modified on the Booking.
 */
const paymentAuditSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        default: null
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    // Action performed — e.g. 'cash_collected', 'online_verified',
    // 'unauthorized_attempt', 'flag_cleared', 'admin_override', 'staff_verified'
    action: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        default: null
    },
    // 'cash', 'razorpay', 'staff_manual', 'admin'
    paymentMethod: {
        type: String,
        default: null
    },
    previousPaymentStatus: {
        type: String,
        default: null
    },
    newPaymentStatus: {
        type: String,
        default: null
    },
    previousCollectionStatus: {
        type: String,
        default: null
    },
    newCollectionStatus: {
        type: String,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    },
    deviceInfo: {
        type: String,
        default: null
    },
    note: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    }
}, {
    // Prevent accidental updates to audit records
    strict: true
});

paymentAuditSchema.index({ bookingId: 1, createdAt: -1 });
paymentAuditSchema.index({ providerId: 1, createdAt: -1 });

const PaymentAudit = mongoose.model('PaymentAudit', paymentAuditSchema);
module.exports = PaymentAudit;
