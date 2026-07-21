const mongoose = require('mongoose');

/**
 * BazaarUnlockTransaction
 * Records every successful paid unlock of a Bazaar ad's contact details by a buyer.
 * Used for admin reporting, duplicate-payment prevention (unique index), and audit trail.
 */
const bazaarUnlockTransactionSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BazaarAd',
    required: true,
    index: true
  },
  // Optional: link to BazaarOffer if unlock happened post-deal-lock
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BazaarOffer',
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  // How the buyer paid: wallet deduction or external gateway
  paymentMode: {
    type: String,
    enum: ['wallet', 'razorpay', 'phonepe', 'free'],
    default: 'wallet'
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'success'
  }
}, {
  timestamps: true
});

// Critical: prevents a buyer from paying twice for the same ad's contact
bazaarUnlockTransactionSchema.index({ buyerId: 1, adId: 1 }, { unique: true });
bazaarUnlockTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BazaarUnlockTransaction', bazaarUnlockTransactionSchema);
