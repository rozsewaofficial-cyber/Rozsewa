const mongoose = require('mongoose');

const subServiceSchema = mongoose.Schema({
    name: { type: String, required: true },
    basePrice: { type: Number, default: 0 },
    description: { type: String },
    sewakPriceBasic: { type: Number, default: 0 },
    sewakPriceStandard: { type: Number, default: 0 },
    sewakPricePremium: { type: Number, default: 0 },
    sewakPriceExpress: { type: Number, default: 0 }
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
    index: { type: Number, default: 0 }, // For ordering
    hasNightCharge: { type: Boolean, default: false },
    nightChargePercent: { type: Number, default: 0 },
    services: [subServiceSchema], // Pre-defined services in this category
    combos: [comboTemplateSchema] // Pre-defined combos in this category
}, {
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
