const mongoose = require('mongoose');

/**
 * An admin-created discounted price on a catalog item — the "🎁 Offer" of the
 * RozSewa Offer System spec.
 *
 * Deliberately NOT called `Offer`: that name is already taken by the
 * provider-submitted promo awaiting admin approval (models/Offer.js), which is
 * an unrelated concept. Two things sharing a name in this codebase is how the
 * cash-collection logic ended up with three diverging copies.
 *
 * Targets are polymorphic because the two catalogs that can carry an offer are
 * shaped differently:
 *   'service'          -> a standalone Service document (Partner catalog)
 *   'category_service' -> an entry embedded in Category.services[] (Sewak)
 */
const serviceOfferSchema = new mongoose.Schema({
    targetType: {
        type: String,
        enum: ['service', 'category_service'],
        required: true
    },
    // Set when targetType === 'service'.
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null
    },
    // Both set when targetType === 'category_service'. subServiceId is the _id
    // of the entry inside Category.services[].
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    subServiceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

    // Display copy, snapshotted from the catalog so the offer card and any
    // historical booking stay readable even if the catalog entry is renamed.
    serviceName: { type: String, required: true },
    categoryName: { type: String, default: '' },

    /**
     * MRP is DERIVED from the catalog, never typed by an admin. Keeping it a
     * read-only mirror means the strikethrough price on the card is always a
     * price the item genuinely carries, and there is exactly one source of
     * truth for it. It is re-read from the catalog on every save.
     */
    originalPrice: { type: Number, required: true, min: 0 },
    offerPrice: { type: Number, required: true, min: 0 },
    // Auto-calculated: ((original - offer) / original) * 100
    discountPercent: { type: Number, required: true, min: 0, max: 100 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    image: { type: String, default: null },

    // The admin's Active/Inactive switch. Independent of the date window —
    // an offer is only live when this is true AND today is inside the window.
    isActive: { type: Boolean, default: true },

    /**
     * Whether RozSewa Coins may be redeemed on top of this offer price.
     * When false, a checkout containing this item refuses a coin redemption.
     */
    allowCoins: { type: Boolean, default: false },

    /**
     * Denormalised lifecycle label, written by the offer cron so the admin list
     * can be filtered and sorted cheaply. It is NOT trusted by the read paths:
     * customer-facing queries always filter on the date window as well, so a
     * missed cron run can never leave an expired offer bookable.
     */
    status: {
        type: String,
        enum: ['scheduled', 'active', 'expired', 'inactive'],
        default: 'scheduled'
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// The customer-facing "what is live right now" query.
serviceOfferSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
// Offer lookup while pricing a booking.
serviceOfferSchema.index({ serviceId: 1, isActive: 1, endDate: 1 });
serviceOfferSchema.index({ categoryId: 1, subServiceId: 1, isActive: 1, endDate: 1 });
// The cron's sweep.
serviceOfferSchema.index({ status: 1, endDate: 1 });

/**
 * True when the offer is live at `at`. Single definition so the model, the
 * controllers and the cron cannot disagree about what "active" means.
 */
serviceOfferSchema.methods.isLiveAt = function (at = new Date()) {
    return this.isActive && this.startDate <= at && this.endDate >= at;
};

module.exports = mongoose.model('ServiceOffer', serviceOfferSchema);
