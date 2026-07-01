const mongoose = require('mongoose');

const partnerProgramSchema = new mongoose.Schema({
    ruleVersion: { type: Number, default: 1 },
    freeTrialEnabled: { type: Boolean, default: true },
    freeServiceCount: { type: Number, default: 3 },
    applyTo: { type: String, enum: ['all', 'selected'], default: 'all' },
    selectedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    trialStarts: { type: String, default: 'immediately_after_approval' },
    trialEnds: { type: String, default: 'exhausted' },
    penalties: {
        cancellationCharge: { type: Number, default: 100 }
    },
    performanceBonuses: {
        silverStarRate: { type: Number, default: 1 },
        goldStarRate: { type: Number, default: 2 },
        loyaltyBonusBookings: { type: Number, default: 100 },
        loyaltyBonusAmount: { type: Number, default: 1000 }
    },
    referral: {
        commissionRate: { type: Number, default: 1 },
        durationMonths: { type: Number, default: 12 }
    },
    attendance: {
        requiredDays: { type: Number, default: 30 },
        discountRate: { type: Number, default: 2 }
    }
}, { timestamps: true });

module.exports = mongoose.model('PartnerProgram', partnerProgramSchema);
