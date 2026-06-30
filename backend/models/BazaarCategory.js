const mongoose = require('mongoose');

const bazaarCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  icon: {
    type: String, // Can store lucide icon name or image URL
    default: 'Package'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('BazaarCategory', bazaarCategorySchema);
