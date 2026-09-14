const mongoose = require('mongoose');
const { PRICING_TYPES } = require('../services/InstaPricingService');

/**
 * The Insta Work service master — what an admin can put on the Insta Work menu.
 *
 * Kept separate from the `Service` catalogue because the two are priced on
 * different bases: a Service carries one fixed price, whereas an Insta service
 * is metered (per hour / km / metre / unit) and additionally supports a flat
 * base charge on top.
 */
const instaServiceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // Lucide icon name, matching how Category stores its icon.
    icon: { type: String, default: 'Zap' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    categoryName: { type: String, default: '' },

    /* ----------------------------- pricing ----------------------------- */

    pricingType: {
        type: String,
        enum: PRICING_TYPES,
        required: true,
        default: 'per_hour'
    },

    /**
     * The rate a Sewak is paid at. Sewaks are a managed workforce, so this is
     * admin-defined and they cannot alter it.
     */
    sewakRate: { type: Number, default: 0, min: 0 },

    /**
     * The guardrail a Partner's own rate must sit inside. Partners set their
     * own price, but only within this admin-defined band — price manipulation
     * is refused at the point the Partner saves their rate, not at checkout.
     */
    minRate: { type: Number, default: 0, min: 0 },
    maxRate: { type: Number, default: 0, min: 0 },

    /**
     * Flat call-out fee charged on top of the metered amount, e.g.
     * Delivery = ₹30 base + ₹15/km. Off unless the admin switches it on.
     */
    baseChargeEnabled: { type: Boolean, default: false },
    baseCharge: { type: Number, default: 0, min: 0 },

    /* --------------------------- availability --------------------------- */

    // How much of the unit a customer may request in one job.
    minQuantity: { type: Number, default: 1, min: 0 },
    maxQuantity: { type: Number, default: 12, min: 0 },

    /**
     * Which supply models can serve this service. A service may be Sewak-only
     * (managed), Partner-only (open market), or both.
     */
    availableFor: {
        type: [String],
        enum: ['sewak', 'partner'],
        default: ['sewak', 'partner']
    },

    // Empty means available everywhere; otherwise restricted to these cities.
    cities: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

instaServiceSchema.index({ isActive: 1, name: 1 });

/** True when this service is offered in the given city. */
instaServiceSchema.methods.servesCity = function (city) {
    if (!this.cities || this.cities.length === 0) return true;
    if (!city) return true;
    return this.cities.some(c => c.toLowerCase() === String(city).toLowerCase());
};

module.exports = mongoose.model('InstaService', instaServiceSchema);
