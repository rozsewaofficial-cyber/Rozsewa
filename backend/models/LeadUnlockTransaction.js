const mongoose = require('mongoose');

const leadUnlockTransactionSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        required: true
    },
    unlockAmount: {
        type: Number,
        required: true,
        default: 0
    },
    walletUsed: {
        type: Boolean,
        default: false
    },
    // How much of a wallet-paid unlock came out of the prepaid wallet (the
    // rest came from earnings), so a refund returns each part where it came
    // from. Absent on unlocks made before this was recorded.
    paidFromPrepaid: {
        type: Number
    },
    creditUsed: {
        type: Boolean,
        default: false
    },
    paymentGateway: {
        type: String,
        enum: ['none', 'Razorpay', 'PhonePe', 'GPay'],
        default: 'none'
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'success'
    }
}, {
    timestamps: true
});

// Ensure a provider cannot unlock the same lead twice (unique combination index)
leadUnlockTransactionSchema.index({ provider: 1, lead: 1 }, { unique: true });
leadUnlockTransactionSchema.index({ createdAt: -1 });

const LeadUnlockTransaction = mongoose.model('LeadUnlockTransaction', leadUnlockTransactionSchema);
module.exports = LeadUnlockTransaction;
