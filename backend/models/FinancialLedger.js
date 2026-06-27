const mongoose = require('mongoose');

const financialLedgerSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    commissionTransactionId: { type: String },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    ledgerType: { 
        type: String, 
        enum: ['COMMISSION', 'SUBSCRIPTION_PAYMENT', 'WALLET_CREDIT', 'WALLET_DEBIT', 'REFUND', 'ADJUSTMENT'], 
        required: true 
    },
    amount: { type: Number, required: true },
    previousBalance: { type: Number, required: true },
    newBalance: { type: Number, required: true },
    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

financialLedgerSchema.index({ transactionId: 1 });
financialLedgerSchema.index({ provider: 1, ledgerType: 1, createdAt: -1 });
financialLedgerSchema.index({ booking: 1 });

module.exports = mongoose.model('FinancialLedger', financialLedgerSchema);
