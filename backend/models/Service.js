const mongoose = require('mongoose');

const serviceSchema = mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: 'Provider'
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    subcategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subcategory'
    },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    subcategory: { type: String },
    price: { type: Number, required: true },
    duration: { type: String, default: '30 min' },
    serviceType: { type: [String], default: ['home'] }, // 'home', 'shop', '24x7'
    visible: { type: Boolean, default: true },
    image: { type: String },
    amenities: [{ type: String }],
    serviceDetails: [{ type: String }],
    useCategoryLeadPrice: { type: Boolean, default: true },
    customLeadPrice: { type: Number, default: 0 },
    // Skill Session gate — mirrored from the category catalog entry.
    skillSessionRequired: { type: Boolean, default: false },
    sessionDurationMinutes: { type: Number, default: 60 },
    sessionMode: { type: String, enum: ['online', 'offline'], default: 'offline' },
    skillSessionActive: { type: Boolean, default: true },
    // Held until the owning Sewak completes their session; flipped by markAttendance.
    pendingSkillSession: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;
