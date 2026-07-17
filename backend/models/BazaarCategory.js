const mongoose = require('mongoose');

const bazaarCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  subCategories: [{
    type: String,
    trim: true
  }],
  icon: {
    type: String, // Can store lucide icon name or image URL
    default: 'Package'
  },
  fields: [{
    name: { type: String, required: true },
    label: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['text', 'number', 'dropdown', 'checkbox', 'textarea', 'date', 'image'],
      required: true
    },
    options: [{ type: String }], // Only populated for dropdowns
    required: { type: Boolean, default: false }
  }],
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
