const mongoose = require('mongoose');
const ServiceOffer = require('../models/ServiceOffer');

/**
 * Everything that decides what an offer is worth and whether it applies.
 *
 * The controllers and the booking pricing path both go through here so that the
 * price shown on an offer card and the price charged at checkout are derived
 * from one piece of logic. `createBooking` deliberately recomputes a trusted
 * subtotal from the catalog and ignores client-sent prices — offer resolution
 * has to happen inside that recomputation, not alongside it, or the card and
 * the bill drift apart.
 */

/** ((original - offer) / original) * 100, rounded to a whole percent. */
const computeDiscountPercent = (originalPrice, offerPrice) => {
    const original = Number(originalPrice) || 0;
    const offer = Number(offerPrice) || 0;
    if (original <= 0) return 0;
    const pct = ((original - offer) / original) * 100;
    // Never report a negative discount; an offer priced above MRP is rejected
    // at validation time, but clamp here too so a bad row can't render "-20% OFF".
    return Math.max(0, Math.min(100, Math.round(pct)));
};

/**
 * Reads the CURRENT catalog price for an offer target.
 *
 * This is the single source of truth for MRP — admins never type it. Returns
 * null when the target no longer exists, which is how a deleted service is
 * detected (the same failure the recent service-deletion fix addressed).
 */
const resolveCatalogTarget = async (target) => {
    const Service = require('../models/Service');
    const Category = require('../models/Category');

    if (target.targetType === 'service') {
        if (!mongoose.Types.ObjectId.isValid(target.serviceId || '')) return null;
        const svc = await Service.findById(target.serviceId).lean();
        if (!svc) return null;
        let categoryName = svc.category || '';
        if (!categoryName && svc.categoryId) {
            const cat = await Category.findById(svc.categoryId).select('name').lean();
            categoryName = cat ? cat.name : '';
        }
        return {
            serviceName: svc.name,
            categoryName,
            originalPrice: Number(svc.price) || 0,
            visible: svc.visible !== false
        };
    }

    if (target.targetType === 'category_service') {
        if (!mongoose.Types.ObjectId.isValid(target.categoryId || '')) return null;
        const cat = await Category.findById(target.categoryId).lean();
        if (!cat) return null;
        const sub = (cat.services || []).find(
            s => s._id && s._id.toString() === String(target.subServiceId)
        );
        if (!sub) return null;
        return {
            serviceName: sub.name,
            categoryName: cat.name,
            originalPrice: Number(sub.basePrice) || 0,
            visible: true
        };
    }

    return null;
};

/** The filter for "live right now", used by every customer-facing read. */
const liveFilter = (at = new Date()) => ({
    isActive: true,
    startDate: { $lte: at },
    endDate: { $gte: at }
});

/**
 * The single active offer for one catalog item, or null.
 *
 * When several offers overlap on the same item the deepest discount wins. The
 * spec doesn't cover overlaps; picking "best for the customer" is the choice
 * least likely to surprise someone who sees two campaigns advertised at once.
 */
const getActiveOfferForTarget = async (target, at = new Date()) => {
    const query = { ...liveFilter(at) };

    if (target.targetType === 'service') {
        if (!mongoose.Types.ObjectId.isValid(target.serviceId || '')) return null;
        query.targetType = 'service';
        query.serviceId = target.serviceId;
    } else if (target.targetType === 'category_service') {
        if (!mongoose.Types.ObjectId.isValid(target.categoryId || '')) return null;
        query.targetType = 'category_service';
        query.categoryId = target.categoryId;
        query.subServiceId = target.subServiceId;
    } else {
        return null;
    }

    return await ServiceOffer.findOne(query).sort({ discountPercent: -1 }).lean();
};

/**
 * Batched lookup for a whole basket — one query per catalog kind rather than
 * one per line item, so a large cart doesn't turn into an N+1.
 *
 * Returns a Map keyed by the id the caller passed in: the Service _id for
 * standalone services, and the sub-service _id for embedded category entries.
 * Both are the id the client sends as `item.id`, so callers can look up
 * directly by that without knowing which catalog it came from.
 */
const getActiveOffersByItemId = async (itemIds, at = new Date()) => {
    const valid = (itemIds || []).filter(id => mongoose.Types.ObjectId.isValid(id || ''));
    const map = new Map();
    if (valid.length === 0) return map;

    const offers = await ServiceOffer.find({
        ...liveFilter(at),
        $or: [
            { targetType: 'service', serviceId: { $in: valid } },
            { targetType: 'category_service', subServiceId: { $in: valid } }
        ]
    }).sort({ discountPercent: -1 }).lean();

    for (const offer of offers) {
        const key = offer.targetType === 'service'
            ? String(offer.serviceId)
            : String(offer.subServiceId);
        // Sorted deepest-discount-first, so the first one seen for a key wins.
        if (!map.has(key)) map.set(key, offer);
    }

    return map;
};

/**
 * Validates an admin's offer payload against the catalog and returns the fields
 * to persist. MRP and discount percent are computed here, never accepted from
 * the request.
 *
 * Throws with a user-facing message on invalid input.
 */
const buildOfferFields = async ({
    targetType, serviceId, categoryId, subServiceId,
    offerPrice, startDate, endDate, image, isActive, allowCoins
}) => {
    if (!['service', 'category_service'].includes(targetType)) {
        throw new Error('Select a valid service to put on offer.');
    }

    const target = { targetType, serviceId, categoryId, subServiceId };
    const catalog = await resolveCatalogTarget(target);
    if (!catalog) {
        throw new Error('That service no longer exists in the catalog.');
    }
    if (catalog.originalPrice <= 0) {
        throw new Error(`"${catalog.serviceName}" has no catalog price set, so it cannot carry an offer.`);
    }

    const price = Number(offerPrice);
    if (!Number.isFinite(price) || price < 0) {
        throw new Error('Offer price must be a valid amount.');
    }
    if (price >= catalog.originalPrice) {
        throw new Error(`Offer price must be below the catalog price of Rs ${catalog.originalPrice}.`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Provide a valid offer start and end date.');
    }
    if (end <= start) {
        throw new Error('Offer end date must be after the start date.');
    }

    return {
        targetType,
        serviceId: targetType === 'service' ? serviceId : null,
        categoryId: targetType === 'category_service' ? categoryId : null,
        subServiceId: targetType === 'category_service' ? subServiceId : null,
        serviceName: catalog.serviceName,
        categoryName: catalog.categoryName,
        originalPrice: catalog.originalPrice,
        offerPrice: price,
        discountPercent: computeDiscountPercent(catalog.originalPrice, price),
        startDate: start,
        endDate: end,
        image: image || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        allowCoins: Boolean(allowCoins),
        status: deriveStatus({ isActive: isActive !== false, startDate: start, endDate: end })
    };
};

/** The lifecycle label for an offer, from its switch and its date window. */
const deriveStatus = ({ isActive, startDate, endDate }, at = new Date()) => {
    if (!isActive) return 'inactive';
    if (endDate < at) return 'expired';
    if (startDate > at) return 'scheduled';
    return 'active';
};

/**
 * Shapes an offer for the customer app — exactly the fields the offer card
 * renders, and nothing internal.
 */
const toPublicCard = (offer) => ({
    _id: offer._id,
    serviceName: offer.serviceName,
    categoryName: offer.categoryName,
    offerPrice: offer.offerPrice,
    originalPrice: offer.originalPrice,
    discountPercent: offer.discountPercent,
    image: offer.image,
    validTill: offer.endDate,
    allowCoins: offer.allowCoins,
    // What the "Book Now" button needs to start a checkout.
    target: {
        targetType: offer.targetType,
        serviceId: offer.serviceId || null,
        categoryId: offer.categoryId || null,
        subServiceId: offer.subServiceId || null,
        // The id the client sends back as item.id, whichever catalog it is from.
        itemId: offer.targetType === 'service' ? offer.serviceId : offer.subServiceId
    }
});

module.exports = {
    computeDiscountPercent,
    resolveCatalogTarget,
    liveFilter,
    getActiveOfferForTarget,
    getActiveOffersByItemId,
    buildOfferFields,
    deriveStatus,
    toPublicCard
};
