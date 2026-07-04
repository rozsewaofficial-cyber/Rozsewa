const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
    },
    title: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed',
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    description: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

transactionSchema.index({ providerId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        unique: true,
        sparse: true,
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        unique: true,
        sparse: true,
    },
    balance: {
        type: Number,
        default: 0,
    },
    availableBalance: {
        type: Number,
        default: 0,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

walletSchema.post('save', function(doc) {
    if (doc.providerId) {
        try {
            const { emitToProvider } = require('../config/socket');
            emitToProvider(doc.providerId, 'WALLET_UPDATED', { balance: doc.balance });
            console.log(`[Socket] Emitted WALLET_UPDATED for Provider ${doc.providerId} with balance ${doc.balance}`);
        } catch (err) {
            console.error('Failed to emit WALLET_UPDATED via socket post-save:', err);
        }
    }
});

const Wallet = mongoose.model('Wallet', walletSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = { Wallet, Transaction };
