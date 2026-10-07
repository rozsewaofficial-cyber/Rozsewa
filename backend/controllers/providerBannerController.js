const mongoose = require('mongoose');
const { pageParams, paginate } = require('../utils/pagination');
const ProviderBanner = require('../models/ProviderBanner');
const Banners = require('../services/BannerService');

const { STATUS, AWAITING_REVIEW } = Banners;

const fail = (res, err) => {
    if (err && err.status) return res.status(err.status).json({ success: false, message: err.message });
    if (err && err.code === 11000) return res.status(409).json({ success: false, message: 'This payment has already been used for a banner.' });
    console.error('[Banners]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
};

const requirePartner = (req) => {
    if (req.user?.role !== 'provider') throw Banners.httpError(403, 'Only partner accounts can buy banner promotions.');
};

const isHttpUrl = (v) => /^https?:\/\/\S+$/i.test(String(v || '').trim());

/**
 * What the partner asked for, checked before any money moves: where it shows
 * and what it shows. The banner's source follows from what was supplied — an
 * uploaded image is used as is, a description alone asks RozSewa to design it.
 */
const readRequest = (body) => {
    const target = Banners.resolveTarget(body.planType, body);
    const imageUrl = String(body.imageUrl || '').trim();
    const designDescription = String(body.designDescription || '').trim().slice(0, 1000);
    if (imageUrl && !isHttpUrl(imageUrl)) throw Banners.httpError(400, 'The banner image link is not valid.');
    if (!imageUrl && !designDescription) throw Banners.httpError(400, 'Upload a banner image or describe the banner you want.');
    return {
        ...target,
        imageUrl: imageUrl || undefined,
        designDescription,
        bannerSource: imageUrl ? 'Upload Own Banner' : 'Create Banner by RozSewa',
        status: imageUrl ? STATUS.PENDING : STATUS.DESIGN
    };
};

// --- Provider Routes ---

// @route GET /api/provider/banner-plans
// @desc  Plans with the server's price for every offered duration (GST shown separately)
exports.getPlans = async (req, res) => {
    try {
        res.json(await Banners.listPlansWithPrices());
    } catch (err) { fail(res, err); }
};

// @route POST /api/provider/banners/order
// @desc  Opens a Razorpay order priced by the server for this plan and duration
exports.createBannerOrder = async (req, res) => {
    try {
        requirePartner(req);
        const Provider = require('../models/Provider');
        const acct = await Provider.findById(req.user._id).select('razorpayDisabled').lean();
        if (acct?.razorpayDisabled) throw Banners.httpError(403, 'Online payment is not enabled for this account. Pay from your wallet instead.');

        const q = await Banners.quote(req.body.planType, req.body.durationDays);
        readRequest(req.body); // reject a bad request before the partner pays for it
        const { createRecordedOrder } = require('./paymentController');
        const order = await createRecordedOrder({
            amount: q.total,
            purpose: 'banner',
            providerId: req.user._id,
            meta: { planType: q.planType, durationDays: q.durationDays, basePrice: q.basePrice, gstAmount: q.gstAmount }
        });
        res.json({ success: true, order, quote: q });
    } catch (err) { fail(res, err); }
};

// @route POST /api/provider/banners
// @desc  Creates the banner request for a VERIFIED Razorpay payment
exports.createBannerRequest = async (req, res) => {
    try {
        requirePartner(req);
        // Validate everything first, so a mistake can be corrected and the
        // same payment presented again — it is only consumed once it is good.
        const details = readRequest(req.body);
        if (!req.body.razorpay_order_id || !req.body.razorpay_payment_id || !req.body.razorpay_signature) {
            throw Banners.httpError(400, 'Payment details are missing.');
        }

        const { claimPayment } = require('./paymentController');
        const claim = await claimPayment(req, { purpose: 'banner', principal: req.user._id });
        if (claim.error) throw Banners.httpError(claim.status, claim.error);

        // Plan, duration and price come off the order that was paid, never
        // off this request.
        // The order was priced by createBannerOrder, so its meta is trusted
        // even if the admin has changed the plans since the partner paid.
        // An order opened through the generic /payment/order has no meta and
        // buys nothing here.
        const meta = claim.order.meta || {};
        const metaOk = Banners.PLAN_TYPES.includes(meta.planType) && Number(meta.durationDays) > 0
            && Math.abs(Number(claim.order.amount) - Number(meta.basePrice) - Number(meta.gstAmount)) <= 0.01;
        if (!metaOk) {
            throw Banners.httpError(400, 'This payment was not made for a banner plan. Contact support with your payment id.');
        }
        if (meta.planType !== req.body.planType) {
            // The location fields were validated for the plan the app sent;
            // re-read them for the plan that was actually paid for.
            Object.assign(details, readRequest({ ...req.body, planType: meta.planType }));
        }

        let banner;
        try {
            banner = await ProviderBanner.create({
                provider: req.user._id,
                planType: meta.planType,
                durationDays: meta.durationDays,
                ...details,
                pricePaid: Number(claim.order.amount),
                basePrice: meta.basePrice,
                gstAmount: meta.gstAmount,
                paidVia: 'razorpay',
                paymentId: req.body.razorpay_payment_id
            });
        } catch (createErr) {
            // The money was taken but no banner exists: release the payment
            // so the same (genuine, signed) payment can be submitted again.
            const PaymentOrder = require('../models/PaymentOrder');
            await PaymentOrder.updateOne(
                { orderId: claim.order.orderId, consumedBy: req.body.razorpay_payment_id },
                { $set: { consumedBy: null, consumedAt: null } }
            ).catch(() => {});
            throw createErr;
        }
        res.status(201).json({ success: true, banner });
    } catch (err) { fail(res, err); }
};

// @route POST /api/provider/banners/wallet
// @desc  Pays for a banner from the wallet's withdrawable balance
exports.createBannerWithWallet = async (req, res) => {
    try {
        requirePartner(req);
        const q = await Banners.quote(req.body.planType, req.body.durationDays);
        const details = readRequest(req.body);
        const { Wallet, Transaction } = require('../models/Wallet');

        // Debit, ledger entry and banner succeed or fail together; the debit
        // is matched on the balance still covering the price, so two requests
        // sent at once cannot both spend the same money.
        const session = await mongoose.startSession();
        let banner = null;
        let wallet = null;
        try {
            await session.withTransaction(async () => {
                wallet = await Wallet.findOneAndUpdate(
                    { providerId: req.user._id, availableBalance: { $gte: q.total } },
                    { $inc: { availableBalance: -q.total }, $set: { updatedAt: Date.now() } },
                    { new: true, session }
                );
                if (!wallet) throw Banners.httpError(400, 'Insufficient wallet available balance.');
                const [txn] = await Transaction.create([{
                    providerId: req.user._id,
                    title: 'Banner Promotion Purchase',
                    amount: q.total,
                    type: 'debit',
                    status: 'completed',
                    description: `Purchased ${q.planType} banner for ${q.durationDays} days (₹${q.basePrice} + ₹${q.gstAmount} GST).`
                }], { session });
                [banner] = await ProviderBanner.create([{
                    provider: req.user._id,
                    planType: q.planType,
                    durationDays: q.durationDays,
                    ...details,
                    pricePaid: q.total,
                    basePrice: q.basePrice,
                    gstAmount: q.gstAmount,
                    paidVia: 'wallet',
                    paymentId: `WALLET_${txn._id}`
                }], { session });
            });
        } finally {
            session.endSession();
        }
        res.status(201).json({ success: true, banner, availableBalance: wallet.availableBalance });
    } catch (err) { fail(res, err); }
};

// @route GET /api/provider/banners
// @desc  The partner's banners — running and pending first, then past ones
exports.getMyBanners = async (req, res) => {
    try {
        await ProviderBanner.updateMany(
            { provider: req.user._id, status: STATUS.ACTIVE, endDate: { $lt: new Date() } },
            { $set: { status: STATUS.EXPIRED } }
        );
        const scope = { provider: req.user._id };
        const [total, banners] = await Promise.all([
            ProviderBanner.countDocuments(scope),
            paginate(ProviderBanner.find(scope).sort({ createdAt: -1 }), pageParams(req))
        ]);
        res.json({ success: true, total, banners });
    } catch (err) { fail(res, err); }
};

// --- Admin Routes ---

// @route GET /api/admin/provider-banners
exports.getAllBanners = async (req, res) => {
    try {
        await ProviderBanner.updateMany(
            { status: STATUS.ACTIVE, endDate: { $lt: new Date() } },
            { $set: { status: STATUS.EXPIRED } }
        );
        const scope = req.query.status ? { status: String(req.query.status) } : {};
        const [total, banners] = await Promise.all([
            ProviderBanner.countDocuments(scope),
            paginate(
                ProviderBanner.find(scope)
                    .populate('provider', 'ownerName shopName mobile vendorCode address city state')
                    .sort({ createdAt: -1 }),
                pageParams(req)
            )
        ]);
        res.json({ success: true, total, banners });
    } catch (err) { fail(res, err); }
};

const ACTIONS = { Approved: 'approve', Active: 'approve', Rejected: 'reject', Stopped: 'stop', Expired: 'stop' };

// @route PUT /api/admin/provider-banners/:id/status
// @desc  approve (goes live now; needs an image) | reject (refunds) | stop (ends a running banner)
exports.updateBannerStatus = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw Banners.httpError(404, 'Banner not found');
        const action = req.body.action || ACTIONS[req.body.status];
        const current = await ProviderBanner.findById(req.params.id);
        if (!current) throw Banners.httpError(404, 'Banner not found');

        if (action === 'approve') {
            const imageUrl = String(req.body.imageUrl || current.imageUrl || '').trim();
            if (!isHttpUrl(imageUrl)) throw Banners.httpError(400, 'Add the banner design (image) before approving it.');
            const start = new Date();
            const end = new Date(start.getTime() + current.durationDays * 24 * 60 * 60 * 1000);
            const banner = await ProviderBanner.findOneAndUpdate(
                { _id: current._id, status: { $in: AWAITING_REVIEW } },
                { $set: { status: STATUS.ACTIVE, imageUrl, startDate: start, endDate: end } },
                { new: true }
            );
            if (!banner) throw Banners.httpError(409, `This banner is already ${current.status}.`);
            await Banners.notifyProvider(banner.provider, 'Banner Approved',
                `Your ${banner.planType} banner is now live until ${end.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.`);
            return res.json({ success: true, banner });
        }

        if (action === 'reject') {
            const banner = await Banners.rejectAndRefund(current._id, { reason: req.body.reason });
            if (!banner) throw Banners.httpError(409, `Only a request awaiting review can be rejected; this one is ${current.status}.`);
            return res.json({ success: true, banner });
        }

        if (action === 'stop') {
            const banner = await ProviderBanner.findOneAndUpdate(
                { _id: current._id, status: STATUS.ACTIVE },
                { $set: { status: STATUS.STOPPED, stoppedAt: new Date(), endDate: new Date() } },
                { new: true }
            );
            if (!banner) throw Banners.httpError(409, 'Only a running banner can be stopped.');
            await Banners.notifyProvider(banner.provider, 'Banner Stopped', `Your ${banner.planType} banner was stopped by RozSewa. Contact support for details.`);
            return res.json({ success: true, banner });
        }

        throw Banners.httpError(400, 'Unknown action.');
    } catch (err) { fail(res, err); }
};

// @route DELETE /api/admin/provider-banners/:id
// @desc  Removes a finished request. A paid one awaiting review must be
//        rejected (which refunds it) and a running one stopped first, so no
//        paid banner disappears without its money being accounted for.
exports.deleteBanner = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw Banners.httpError(404, 'Banner not found');
        const banner = await ProviderBanner.findById(req.params.id);
        if (!banner) throw Banners.httpError(404, 'Banner not found');
        const paid = Number(banner.pricePaid) > 0;
        if (paid && (AWAITING_REVIEW.includes(banner.status) || banner.status === STATUS.ACTIVE)) {
            throw Banners.httpError(400, banner.status === STATUS.ACTIVE
                ? 'Stop this running banner before deleting it.'
                : 'Reject this request first — that refunds the partner — then delete it.');
        }
        await ProviderBanner.deleteOne({ _id: banner._id });
        res.json({ success: true, message: 'Banner deleted successfully' });
    } catch (err) { fail(res, err); }
};

// --- Public / User Routes ---

// @route GET /api/public/provider-banners/active
// @desc  Live banners for the customer's location, best plan first, a few at a time
exports.getActiveBannersByLocation = async (req, res) => {
    try {
        const place = Banners.customerPlace(req.query);
        const banners = await ProviderBanner.find({
            ...Banners.liveFilter(),
            imageUrl: { $regex: /^https?:\/\//i },
            $or: Banners.locationConditions(place)
        })
            .select('provider planType imageUrl locationValue')
            .populate('provider', 'shopName ownerName profileImage rating')
            .limit(200)
            .lean();

        const limit = Math.min(Banners.CAROUSEL_SLOTS, Math.max(1, Number(req.query.limit) || Banners.CAROUSEL_SLOTS));
        res.json({ success: true, banners: Banners.rankBanners(banners).slice(0, limit) });
    } catch (err) { fail(res, err); }
};

const liveIds = async (ids) => {
    const valid = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))]
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .slice(0, Banners.CAROUSEL_SLOTS * 2);
    if (!valid.length) return [];
    const live = await ProviderBanner.find({ _id: { $in: valid }, ...Banners.liveFilter() }).select('_id').lean();
    return live.map(b => b._id);
};

// @route POST /api/public/provider-banners/impressions
// @desc  Counts banners the customer actually saw (the app reports each once per visit)
exports.trackImpressions = async (req, res) => {
    try {
        const ids = await liveIds(req.body?.ids);
        if (ids.length) await ProviderBanner.updateMany({ _id: { $in: ids } }, { $inc: { 'analytics.views': 1 } });
        res.json({ success: true, counted: ids.length });
    } catch (err) { fail(res, err); }
};

// @route POST /api/public/provider-banners/:id/click
exports.trackClick = async (req, res) => {
    try {
        const [id] = await liveIds(req.params.id);
        if (id) await ProviderBanner.updateOne({ _id: id }, { $inc: { 'analytics.clicks': 1 } });
        res.json({ success: true });
    } catch (err) { fail(res, err); }
};

/**
 * Credits an order to the banner the customer tapped before booking — only
 * when that banner is running and belongs to the partner booked.
 */
exports.creditOrderToBanner = async (bannerId, providerId) => {
    try {
        if (!bannerId || !providerId || !mongoose.Types.ObjectId.isValid(bannerId)) return;
        await ProviderBanner.updateOne(
            { _id: bannerId, provider: providerId, ...Banners.liveFilter() },
            { $inc: { 'analytics.orders': 1 } }
        );
    } catch (err) {
        console.error('[Banners] Could not credit order to banner:', err.message);
    }
};
