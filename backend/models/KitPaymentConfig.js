const mongoose = require('mongoose');

/**
 * Category-wise payment rules for starter kit / combo purchases.
 *
 * Deliberately its own collection rather than fields on Category:
 * adminController.updateCategory rebuilds parts of the Category document from a
 * hardcoded field whitelist, so anything added there gets silently wiped on the
 * next category edit. See STARTER_KIT_PLAN.md D1 / Trap 1.
 */
const kitPaymentConfigSchema = mongoose.Schema({
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        unique: true
    },

    // What the Sewak is allowed to pick at checkout.
    paymentMode: { type: String, enum: ['full', 'part', 'both'], default: 'full' },

    downPaymentType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    downPaymentValue: { type: Number, default: 50, min: 0 },

    deductionFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },

    // Fixed rupee amount taken per deduction cycle (SRS: "roz fixed amount deduct hoga").
    instalmentAmount: { type: Number, default: 0, min: 0 },

    weeklyDeductionDay: { type: Number, default: 1, min: 0, max: 6 },   // 0 = Sunday
    // Capped at 28 so a monthly schedule never silently skips February.
    monthlyDeductionDate: { type: Number, default: 1, min: 1, max: 28 },

    blockPayoutOnDues: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('KitPaymentConfig', kitPaymentConfigSchema);
