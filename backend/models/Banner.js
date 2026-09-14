const mongoose = require('mongoose');

const bannerSchema = mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
    ctaLink: { type: String, default: '/shops' },
    ctaText: { type: String, default: 'Book Now' },
    active: { type: Boolean, default: true },
    priority: { type: Number, default: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);
