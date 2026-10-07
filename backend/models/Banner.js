const mongoose = require('mongoose');

const bannerSchema = mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
    videoUrl: { type: String, default: '' }, // optional short video shown instead of the image, under 10MB
    ctaLink: { type: String, default: '/shops' },
    ctaText: { type: String, default: 'Book Now' },
    active: { type: Boolean, default: true },
    // Higher shows first.
    priority: { type: Number, default: 0 },
    // Optional schedule; an empty end runs until switched off.
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null }
}, {
    timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);
