const mongoose = require('mongoose');

const bazaarChatTemplateSchema = new mongoose.Schema({
  text: { type: String, required: true },
  // 'buyer' = shown only to buyers, 'seller' = shown only to sellers, 'both' = shown to everyone
  forRole: {
    type: String,
    enum: ['buyer', 'seller', 'both'],
    default: 'buyer'
  },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('BazaarChatTemplate', bazaarChatTemplateSchema);
