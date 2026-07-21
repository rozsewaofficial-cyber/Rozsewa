const mongoose = require('mongoose');

const bazaarAdSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    minlength: 20,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  subCategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor', 'Not Applicable', 'Used', 'Refurbished'], // Expanded enum to prevent errors for now
    default: 'Good'
  },
  dynamicFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  isNegotiable: {
    type: Boolean,
    default: false
  },
  images: [{
    type: String,
    required: true
  }], // Backend will validate min 2, max 10
  location: {
    // GeoJSON point for radius search
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    // Masked address details for public view
    areaName: { type: String, required: true },
    city: { type: String, required: true, index: true },
    state: { type: String },
    // Hidden exact details (only revealed after lead unlock)
    exactAddress: { type: String },
    houseNumber: { type: String }
  },
  status: {
    type: String,
    enum: ['pending_review', 'live', 'deal_locked', 'sold', 'expired', 'rejected', 'cancelled'],
    default: 'pending_review',
    index: true
  },
  rejectionReason: {
    type: String
  },
  // Admin can override unlock fee per product (null = use global Setting default)
  unlockFee: {
    type: Number,
    default: null
  },
  // Internal admin note added during approval (not visible to seller/buyer)
  adminNote: {
    type: String
  },
  // Analytics
  metrics: {
    views: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    offersCount: { type: Number, default: 0 }
  },
  // Hidden contact info for lead unlock
  contactDetails: {
    phone: { type: String, required: true },
    isVerified: { type: Boolean, default: false }
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create 2dsphere index for location-based searches
bazaarAdSchema.index({ 'location': '2dsphere' });
// Compound index for efficient searching and filtering
bazaarAdSchema.index({ status: 1, category: 1, price: 1 });

module.exports = mongoose.model('BazaarAd', bazaarAdSchema);
