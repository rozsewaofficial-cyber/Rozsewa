const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    bankDetails: {
        accountHolderName: String,
        accountNumber: String,
        bankName: String,
        ifscCode: String
    },
    reason: { type: String } // For rejection reason
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
