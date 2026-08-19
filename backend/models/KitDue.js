const mongoose = require('mongoose');

/**
 * The EMI schedule for one part-payment kit order.
 *
 * `frequency` and `instalmentAmount` are SNAPSHOTTED from KitPaymentConfig at
 * order time rather than read live — otherwise an admin editing the category
 * config would silently rewrite the repayment terms of every existing debt.
 */
const kitDueSchema = mongoose.Schema({
    sewakId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'KitOrder', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },

    totalDue: { type: Number, required: true },
    paidSoFar: { type: Number, default: 0 },
    balance: { type: Number, required: true },

    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    instalmentAmount: { type: Number, required: true },

    nextDeductionDate: { type: Date, required: true, index: true },

    status: { type: String, enum: ['active', 'cleared', 'cancelled'], default: 'active' },

    // Incremented when a scheduled deduction couldn't be taken (e.g. it would have
    // breached the account-lockout debt limit). Recorded, never blocking.
    missedCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    clearedAt: { type: Date, default: null }
}, {
    timestamps: true
});

kitDueSchema.index({ status: 1, nextDeductionDate: 1 });  // the cron's query
kitDueSchema.index({ sewakId: 1, status: 1 });

module.exports = mongoose.model('KitDue', kitDueSchema);
