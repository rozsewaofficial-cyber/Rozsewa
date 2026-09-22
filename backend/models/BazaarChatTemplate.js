const mongoose = require('mongoose');

const bazaarChatTemplateSchema = new mongoose.Schema({
  text: { type: String, required: true },
  // 'buyer' = shown only to buyers, 'seller' = shown only to sellers, 'both' = shown to everyone
  forRole: {
    type: String,
    enum: ['buyer', 'seller', 'both'],
    default: 'buyer'
  },

  // What the template is for. "Kitna chala hai?" belongs on a bike, not on a
  // sofa, so a template can be pinned to a category and, within it, to one
  // subcategory. Both empty means it applies everywhere, which is what every
  // template written before this did — so they keep working untouched.
  category: { type: String, default: '', trim: true },
  subCategory: { type: String, default: '', trim: true },

  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

// Looked up on every chat open and on every message sent.
bazaarChatTemplateSchema.index({ isActive: 1, category: 1, subCategory: 1 });

module.exports = mongoose.model('BazaarChatTemplate', bazaarChatTemplateSchema);
