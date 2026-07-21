const mongoose = require('mongoose');

/**
 * BazaarPIIViolation Schema
 * Logs any attempt to share contact numbers, emails, addresses, or off-platform contact details in chat.
 */
const bazaarPIIViolationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BazaarAd',
    required: true
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BazaarOffer'
  },
  attemptedText: {
    type: String,
    required: true
  },
  detectedType: {
    type: String, // 'phone', 'phone_obfuscated', 'email', 'contact_request', 'address', 'template_bypass'
    required: true
  },
  reason: {
    type: String
  },
  status: {
    type: String,
    enum: ['blocked', 'reviewed', 'dismissed'],
    default: 'blocked'
  }
}, { timestamps: true });

bazaarPIIViolationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BazaarPIIViolation', bazaarPIIViolationSchema);
