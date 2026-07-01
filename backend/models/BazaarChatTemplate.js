const mongoose = require('mongoose');

const bazaarChatTemplateSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('BazaarChatTemplate', bazaarChatTemplateSchema);
