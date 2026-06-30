const mongoose = require('mongoose');

const scrapSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  images: [{
    type: String
  }],
  address: {
    addressLine1: String,
    city: String,
    state: String,
    pincode: String,
    lat: Number,
    lng: Number
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    default: null
  },
  pickupDate: {
    type: Date
  },
  finalPrice: {
    type: Number
  },
  listedInBazaar: {
    type: Boolean,
    default: false,
    index: true
  },
  contactPhone: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Scrap', scrapSchema);
