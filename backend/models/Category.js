const mongoose = require('mongoose');

const subServiceSchema = mongoose.Schema({
    name: { type: String, required: true },
    basePrice: { type: Number, default: 0 },
    // A higher reference amount shown alongside basePrice so the actual
    // price reads like a discount off it. Optional — 0 means none is set.
    offerPrice: { type: Number, default: 0 },
    description: { type: String },
    image: { type: String },
    // Skill Session gate — a Sewak must complete training before this service goes live.
    // `skillSessionActive` suspends the requirement without losing its config.
    skillSessionRequired: { type: Boolean, default: false },
    sessionDurationMinutes: { type: Number, default: 60 },
    sessionMode: { type: String, enum: ['online', 'offline'], default: 'offline' },
    skillSessionActive: { type: Boolean, default: true },
    // Which provider type can pick this service for their own profile.
    visibleTo: { type: String, enum: ['sewak', 'partner', 'both'], default: 'both' }
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
    // Used instead of nightChargePercent when the global night charge mode
    // (Setting key 'night_charge_config'.chargeType) is 'flat' rather than
    // 'percent'. Kept alongside rather than replacing it, so switching modes
    // back and forth doesn't lose whichever figure isn't currently active.
    nightChargeFlatAmount: { type: Number, default: 0 },
    services: [subServiceSchema], // Pre-defined services in this category
    combos: [comboTemplateSchema], // Pre-defined combos in this category
    businessModel: { type: String, enum: ['commission', 'lead'], default: 'commission' },
    // Which provider type can register into / pick this category.
    visibleTo: { type: String, enum: ['sewak', 'partner', 'both'], default: 'both' },
    defaultLeadPrice: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
