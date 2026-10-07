const mongoose = require('mongoose');
const Setting = require('../models/Setting');
const ProviderBanner = require('../models/ProviderBanner');
const Notification = require('../models/Notification');

/**
 * Paid partner banners: what a plan costs, where a banner shows, and how a
 * paid request is refunded. Everything money-related is decided here, on the
 * server — the partner's app only displays these figures, it never supplies
 * them.
 */

const PLAN_TYPES = ['Premium Top', 'Local', 'City', 'District', 'State'];
// Display order in the carousel and the listing boost: the plan sold as "top
// featured" first, then the most specific targeting.
const PLAN_RANK = { 'Premium Top': 0, Local: 1, City: 2, District: 3, State: 4 };
// How many partner banners one carousel shows at most; banners beyond this
// rotate in on later loads rather than making the carousel endless.
const CAROUSEL_SLOTS = 10;
const GST_PERCENT = 18;

const DEFAULT_PLANS = [
    { id: 'Local', title: 'Local Promotion', desc: 'Show to users in your PIN code', price: 199 },
    { id: 'City', title: 'City Level', desc: 'Promote across your entire city', price: 499 },
    { id: 'District', title: 'District Level', desc: 'Maximum reach in your district', price: 999 },
    { id: 'State', title: 'State Level', desc: 'Dominant state-wide visibility', price: 1999 },
    { id: 'Premium Top', title: 'Premium Top', desc: 'Shown first in the partner banners on the Home Page, in every city', price: 2999 }
];
const DEFAULT_DURATIONS = [7];

const STATUS = {
    PENDING: 'Pending Approval',
    DESIGN: 'Banner Design Required',
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    REJECTED: 'Rejected',
    STOPPED: 'Stopped'
};
const AWAITING_REVIEW = [STATUS.PENDING, STATUS.DESIGN];

const roundRupees = (n) => Math.round(Number(n) * 100) / 100;

/**
 * The plans and durations the admin configured. A plan's `price` is for the
 * first (base) duration; a longer duration costs proportionally more, so 30
 * days is never sold at the 7-day price.
 */
const getPlanConfig = async () => {
    const [planSetting, durationSetting] = await Promise.all([
        Setting.findOne({ key: 'provider_banner_plans' }).lean(),
        Setting.findOne({ key: 'provider_banner_durations' }).lean()
    ]);
    const rawPlans = Array.isArray(planSetting?.value) && planSetting.value.length ? planSetting.value : DEFAULT_PLANS;
    const plans = rawPlans
        .filter(p => p && PLAN_TYPES.includes(p.id) && Number(p.price) > 0 && p.active !== false)
        .map(p => ({ id: p.id, title: p.title || p.id, desc: p.desc || '', price: Number(p.price) }));
    const durations = (Array.isArray(durationSetting?.value) ? durationSetting.value : [])
        .map(Number)
        .filter(d => Number.isInteger(d) && d > 0 && d <= 365);
    return { plans, durations: durations.length ? [...new Set(durations)] : DEFAULT_DURATIONS };
};

const priceFor = (plan, durationDays, baseDuration) => {
    const base = roundRupees(plan.price * durationDays / baseDuration);
    const gst = roundRupees(base * GST_PERCENT / 100);
    return { basePrice: base, gstAmount: gst, total: roundRupees(base + gst) };
};

/** Plans with the price of every allowed duration, for the partner's screen. */
const listPlansWithPrices = async () => {
    const { plans, durations } = await getPlanConfig();
    return {
        durations,
        gstPercent: GST_PERCENT,
        plans: plans.map(p => ({
            ...p,
            prices: Object.fromEntries(durations.map(d => [d, priceFor(p, d, durations[0])]))
        }))
    };
};

/**
 * The authoritative price of a plan for a duration. Throws a 400-style error
 * for a plan or duration the admin does not offer.
 */
const quote = async (planType, durationDays) => {
    const { plans, durations } = await getPlanConfig();
    const plan = plans.find(p => p.id === planType);
    if (!plan) throw httpError(400, 'This banner plan is not available.');
    const days = Number(durationDays);
    if (!durations.includes(days)) throw httpError(400, `Choose one of the offered durations: ${durations.join(', ')} days.`);
    return { planType, durationDays: days, ...priceFor(plan, days, durations[0]) };
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ---- Location -------------------------------------------------------------

/**
 * A place name reduced to what identifies it, so "Indore District",
 * " indore " and "INDORE" all target the same customers. Also what makes the
 * lookup a plain equality instead of a regex built from user input.
 */
const normalizePlace = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(district|city|division|tehsil|tahsil)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Validates and normalises where a banner should show. Returns the stored
 * fields, or throws a 400-style error.
 */
const resolveTarget = (planType, body = {}) => {
    const pick = {
        Local: body.targetPincode ?? body.locationValue,
        City: body.targetCity ?? body.locationValue,
        District: body.targetDistrict ?? body.locationValue,
        State: body.targetState ?? body.locationValue
    };
    if (planType === 'Premium Top') {
        return { locationValue: 'ALL', locationKey: 'all' };
    }
    const raw = String(pick[planType] || '').trim();
    if (planType === 'Local') {
        if (!/^\d{6}$/.test(raw)) throw httpError(400, 'Enter a valid 6-digit PIN code for a Local banner.');
        return { locationValue: raw, locationKey: raw, targetPincode: raw };
    }
    const key = normalizePlace(raw);
    if (!key) throw httpError(400, `Enter the ${planType.toLowerCase()} this banner should show in.`);
    const field = { City: 'targetCity', District: 'targetDistrict', State: 'targetState' }[planType];
    return { locationValue: raw.slice(0, 100), locationKey: key, [field]: raw.slice(0, 100) };
};

/** The customer's location, normalised the same way. */
const customerPlace = ({ pincode, city, district, state } = {}) => ({
    pincode: /^\d{6}$/.test(String(pincode || '').trim()) ? String(pincode).trim() : null,
    city: normalizePlace(city) || null,
    district: normalizePlace(district) || null,
    state: normalizePlace(state) || null
});

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Mongo conditions for banners that target this customer. Banners saved
 * before `locationKey` existed are matched by their display name, escaped.
 */
const locationConditions = (place) => {
    const or = [{ planType: 'Premium Top' }];
    const add = (planType, key) => {
        if (!key) return;
        or.push({ planType, locationKey: key });
        or.push({ planType, locationKey: { $exists: false }, locationValue: { $regex: new RegExp(`^\\s*${escapeRegex(key)}(\\s+district)?\\s*$`, 'i') } });
    };
    if (place.pincode) or.push({ planType: 'Local', locationValue: place.pincode });
    add('City', place.city);
    add('District', place.district);
    add('State', place.state);
    return or;
};

/** The same test in memory, for banners already loaded. */
const bannerTargets = (banner, place) => {
    if (banner.planType === 'Premium Top') return true;
    const key = banner.locationKey || normalizePlace(banner.locationValue);
    if (banner.planType === 'Local') return !!place.pincode && String(banner.locationValue).trim() === place.pincode;
    if (banner.planType === 'City') return !!place.city && key === place.city;
    if (banner.planType === 'District') return !!place.district && key === place.district;
    if (banner.planType === 'State') return !!place.state && key === place.state;
    return false;
};

/** Running right now: active, inside its dates, and with something to show. */
const liveFilter = (now = new Date()) => ({
    status: STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gte: now }
});

/** Orders banners by plan rank; banners of the same rank take turns. */
const rankBanners = (banners, random = Math.random) => banners
    .map(b => ({ b, r: PLAN_RANK[b.planType] ?? 9, t: random() }))
    .sort((x, y) => x.r - y.r || x.t - y.t)
    .map(x => x.b);

// ---- Notifications --------------------------------------------------------

const notifyProvider = async (providerId, title, message) => {
    try {
        const notif = await Notification.create({
            recipientId: providerId,
            recipientModel: 'Provider',
            title,
            message,
            type: 'system'
        });
        try {
            const { getIO } = require('../config/socket');
            const io = getIO();
            if (io) io.to(`provider_${providerId}`).emit('newNotification', notif);
        } catch (_) { /* socket not initialised (scripts, tests) */ }
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(providerId, 'provider', { title, body: message, data: { type: 'banner', link: '/provider/banner-promotions' } });
        } catch (_) { /* push is best-effort */ }
    } catch (err) {
        console.error('[Banners] Could not notify provider:', err.message);
    }
};

// ---- Refunds --------------------------------------------------------------

/**
 * How much of a banner's price is known to have actually been paid.
 *
 * Banners bought through the current flow record how they were paid
 * (`paidVia`), so their price is trustworthy. Older requests took `pricePaid`
 * and `paymentId` straight from the app with no verification, so their price
 * proves nothing — except the old wallet purchases (`WALLET_…`), which really
 * did debit exactly that amount. Anything else is left for a person to check
 * against Razorpay rather than paid out automatically.
 */
const verifiedPaidAmount = (banner) => {
    const price = roundRupees(banner.pricePaid);
    if (!(price > 0)) return 0;
    if (banner.paidVia === 'wallet' || banner.paidVia === 'razorpay') return price;
    if (String(banner.paymentId || '').startsWith('WALLET_')) return price;
    return 0;
};

/**
 * Rejects a request that is still awaiting review and returns what was
 * verifiably paid to the partner's wallet (withdrawable balance), exactly
 * once. The status change and the credit happen in one transaction, and the
 * status is matched on the way in, so two clicks cannot refund twice. An
 * older request whose payment cannot be verified is rejected and marked for a
 * manual refund instead of crediting an amount nobody may have paid.
 */
const rejectAndRefund = async (bannerId, { reason = '' } = {}) => {
    const { Wallet, Transaction } = require('../models/Wallet');
    const session = await mongoose.startSession();
    let result = null;
    try {
        await session.withTransaction(async () => {
            const banner = await ProviderBanner.findOneAndUpdate(
                { _id: bannerId, status: { $in: AWAITING_REVIEW }, 'refund.status': { $ne: 'refunded' } },
                { $set: { status: STATUS.REJECTED, rejectionReason: String(reason).slice(0, 300) } },
                { new: true, session }
            );
            if (!banner) { result = null; return; }

            const amount = verifiedPaidAmount(banner);
            if (amount <= 0 && roundRupees(banner.pricePaid) > 0) {
                banner.refund = { status: 'manual' };
                await banner.save({ session });
            }
            if (amount > 0) {
                await Wallet.findOneAndUpdate(
                    { providerId: banner.provider },
                    { $inc: { availableBalance: amount }, $setOnInsert: { balance: 0 }, $set: { updatedAt: Date.now() } },
                    { upsert: true, new: true, session }
                );
                const [txn] = await Transaction.create([{
                    providerId: banner.provider,
                    title: 'Banner Promotion Refund',
                    amount,
                    type: 'credit',
                    status: 'completed',
                    description: `Refund for rejected ${banner.planType} banner request.`
                }], { session });
                banner.refund = { status: 'refunded', amount, at: new Date(), transactionId: txn._id };
                await banner.save({ session });
            }
            result = banner;
        });
    } finally {
        session.endSession();
    }
    if (result) {
        const refunded = result.refund?.status === 'refunded';
        await notifyProvider(result.provider,
            'Banner Request Rejected',
            `Your ${result.planType} banner request was rejected${result.rejectionReason ? `: ${result.rejectionReason}` : ''}.`
            + (refunded ? ` ₹${result.refund.amount} has been refunded to your wallet.` : (result.refund?.status === 'manual' ? ' Our team will review your payment for a refund.' : '')));
    }
    return result;
};

module.exports = {
    PLAN_TYPES,
    PLAN_RANK,
    CAROUSEL_SLOTS,
    GST_PERCENT,
    STATUS,
    AWAITING_REVIEW,
    getPlanConfig,
    listPlansWithPrices,
    quote,
    priceFor,
    httpError,
    normalizePlace,
    resolveTarget,
    customerPlace,
    escapeRegex,
    locationConditions,
    bannerTargets,
    liveFilter,
    rankBanners,
    notifyProvider,
    verifiedPaidAmount,
    rejectAndRefund
};
