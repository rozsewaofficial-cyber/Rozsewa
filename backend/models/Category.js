const mongoose = require('mongoose');

const subServiceSchema = mongoose.Schema({
    name: { type: String, required: true },
    basePrice: { type: Number, default: 0 },
    description: { type: String },
    image: { type: String }
});

const comboTemplateSchema = mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    services: [String], // List of service names
    sewakPrice: { type: Number, default: 0 },
    image: { type: String }
});

const categorySchema = mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String },
    icon: { type: String }, // Lucide icon name
    isActive: { type: Boolean, default: true },
    isComingSoon: { type: Boolean, default: false },
    index: { type: Number, default: 0 }, // For ordering
    hasNightCharge: { type: Boolean, default: false },
    nightChargePercent: { type: Number, default: 0 },
    services: [subServiceSchema], // Pre-defined services in this category
    combos: [comboTemplateSchema], // Pre-defined combos in this category
    businessModel: { type: String, enum: ['commission', 'lead'], default: 'commission' },
    defaultLeadPrice: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
