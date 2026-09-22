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

  // What it costs a buyer to unlock a seller's contact, per subcategory.
  //
  // Kept beside the subcategory names rather than folded into them, because
  // `subCategories` is a plain string array that ads, filters and the admin
  // picker all read — turning it into objects would break every one of them.
  // A subcategory with no entry here falls back to the global fee, so this is
  // an override list and not a required table.
  subCategoryUnlockFees: [{
    _id: false,
    subCategory: { type: String, required: true, trim: true },
    unlockFee: { type: Number, required: true, min: 0 }
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
