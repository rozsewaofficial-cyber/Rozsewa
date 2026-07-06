const mongoose = require('mongoose');

const partnerPolicySchema = new mongoose.Schema({
    category: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Category', 
        required: true,
        unique: true
    },
    
    // Welcome Offer
    welcomeOffer: {
        freeServicesCount: { type: Number, default: 3 }
    },
    
    // Performance Rewards (Order-Based Discount for next month)
    performanceDiscounts: [{
        ordersCount: { type: Number, required: true }, // e.g. 20
        discountPercent: { type: Number, required: true } // e.g. 1
    }],
    
    // Star Rating Rewards
    starRatingRewards: {
        silver: {
            minRating: { type: Number, default: 4.5 },
            durationMonths: { type: Number, default: 6 },
            bonusPercent: { type: Number, default: 1 }
        },
        gold: {
            minRating: { type: Number, default: 4.8 },
            durationMonths: { type: Number, default: 12 },
            bonusPercent: { type: Number, default: 2 } // "Additional 1%" in policy means total 2% or just 1% extra
        }
    },
    
    // Loyalty Rewards
    loyaltyRewards: [{
        bookingsCount: { type: Number, required: true }, // e.g. 100
        bonusType: { type: String, enum: ['cash', 'gift'], default: 'cash' },
        bonusAmount: { type: Number }, // e.g. 1000
        giftDescription: { type: String } // e.g. "Exclusive Gift Reward"
    }],
    
    // Trusted Partner Badge Requirements
    trustedPartner: {
        minRating: { type: Number, default: 4.8 },
        minCompletedOrders: { type: Number, default: 100 }
    },

    // Vendor Welfare
    surakshaNidhi: {
        enabled: { type: Boolean, default: true },
        minDeduction: { type: Number, default: 1 },
        maxDeduction: { type: Number, default: 2 }
    },
    noWorkProtectionMonths: { type: Number, default: 3 },
    
    // Referral & Growth Program
    referralBonus: {
        firstOrderBonus: { type: Number, default: 200 },
        milestoneOrders: { type: Number, default: 20 },
        milestoneBonus: { type: Number, default: 300 }
    },
    
    // Customer Retention
    repeatCustomerReward: {
        repeatBookings: { type: Number, default: 10 },
        bonusAmount: { type: Number, default: 200 }
    },
    
    // Operational Terms
    cancellationCharges: {
        thresholdValue: { type: Number, default: 500 },
        belowPenalty: { type: Number, default: 50 },
        abovePenalty: { type: Number, default: 100 }
    },
    minimumWalletBalance: { type: Number, default: 200 }
}, {
    timestamps: true
});

module.exports = mongoose.model('PartnerPolicy', partnerPolicySchema);
