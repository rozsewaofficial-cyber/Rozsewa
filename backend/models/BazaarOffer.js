const mongoose = require('mongoose');

const bazaarOfferSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BazaarAd',
    required: true,
    index: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Communication is strictly via predefined actions or numeric offers
  offerHistory: [{
    actionType: {
      type: String,
      enum: ['numeric_offer', 'predefined_query', 'system_message'],
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    numericAmount: {
      type: Number // Only present if actionType is numeric_offer
    },
    predefinedMessage: {
      type: String, // E.g., 'Available?', 'Pickup Only?', 'Bill Available?', 'Warranty?'
      enum: ['Available?', 'Pickup Only?', 'Bill Available?', 'Warranty?', 'Delivery Possible?', 'Price Negotiable?']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  currentOfferAmount: {
    type: Number
  },
  status: {
    type: String,
    enum: ['pending', 'countered', 'accepted', 'rejected', 'deal_locked'],
    default: 'pending',
    index: true
  },
  // To limit bargaining attempts
  counterAttempts: {
    type: Number,
    default: 0
  },
  // Lead Unlock Status
  isLeadUnlockedByBuyer: {
    type: Boolean,
    default: false
  },
  isLeadUnlockedBySeller: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure a buyer can only have one active offer thread per ad
bazaarOfferSchema.index({ adId: 1, buyerId: 1 }, { unique: true });

module.exports = mongoose.model('BazaarOffer', bazaarOfferSchema);
