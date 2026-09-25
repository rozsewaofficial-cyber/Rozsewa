const { pageParams, paginate } = require('../utils/pagination');
const EarningsAnalyticsService = require('../services/EarningsAnalyticsService');
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const AuditLog = require('../models/AuditLog');
const SewakIncentiveLog = require('../models/SewakIncentiveLog');
const Employee = require('../models/Employee');
const Coupon = require('../models/Coupon');
const LoginLog = require('../models/LoginLog');
const axios = require('axios');
const { teamCodesFor, sewaksOfTeam, teamSewakIds } = require('../utils/supervisorScope');
// Trigger restart

// @desc    Get all providers for admin
// @route   GET /api/admin/providers
// @access  Private/Admin
/**
 * What an admin screen is asking for when it asks for providers: the status
 * tab, the partner/sewak split, and anything typed into the search box.
 *
 * Shared with the stats below so a tab's count and the rows under it can never
 * describe two different sets. `includeSearch` is false for the stats: the
 * cards keep describing the whole scope while the table answers what was typed.
 */
const adminProviderScope = (params, { includeSearch = true } = {}) => {
    const { status, category, providerCategory, city } = params;
    const query = status ? { status } : {};

    const cat = category || providerCategory;
    if (cat === 'sewak') {
        query.providerCategory = 'sewak';
    } else if (cat === 'partner') {
        query.providerCategory = { $ne: 'sewak' };
    }

    const escape = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
    if (params.businessType && params.businessType !== 'all') query.businessType = params.businessType;

    if (city && city !== 'all') query.city = new RegExp(`^${escape(city)}$`, "i");

    // The joined-on range, as the screen's two date pickers describe it.
    const { from, to } = params;
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
        if (to) query.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    // Subscription state, as the subscriptions screen groups it: paying, lapsed,
    // or never subscribed. "Expired" is a subscription with a date in the past,
    // which is why it cannot be a plain field match.
    const now = new Date();
    if (params.subscription === 'subscribed') {
        query.isSubscribed = true;
        query.$and = (query.$and || []).concat([{
            $or: [{ subscriptionExpiry: null }, { subscriptionExpiry: { $gte: now } }]
        }]);
    } else if (params.subscription === 'expired') {
        query.isSubscribed = true;
        query.subscriptionExpiry = { $lt: now };
    } else if (params.subscription === 'free') {
        query.isSubscribed = { $ne: true };
    }

    const term = String(includeSearch ? (params.search || "") : "").trim();
    if (term) {
        const rx = new RegExp(escape(term), "i");
        query.$or = [
            { shopName: rx },
            { ownerName: rx },
            { mobile: rx },
            { email: rx },
            { vendorCode: rx }
        ];
    }

    return query;
};

// A provider document carries its KYC documents, its Insta service list and
// its push tokens. None of that belongs in a table of providers.
const PROVIDER_LIST_FIELDS = '-password -documents -fcmTokens -fcmTokenMobile -subServices -instaWork.services';

const getProviders = async (req, res) => {
    try {
        const query = adminProviderScope(req.query);
        const providers = await paginate(
            Provider.find(query)
                .select(PROVIDER_LIST_FIELDS)
                .sort({ createdAt: -1 }),
            pageParams(req)
        );

        // How many matched, so a screen showing a page can say so.
        res.set('X-Total-Count', String(await Provider.countDocuments(query)));
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    One provider, in full — including the documents the list view
//          deliberately leaves out (PROVIDER_LIST_FIELDS strips them, since
//          a row of every uploaded document's URL would bloat a page of
//          twenty providers for a table that never displays them). The
//          Details modal used to just reuse the row it already had from the
//          list, which is exactly why "Identity Documents" always read as
//          missing regardless of what a provider had actually submitted.
// @route   GET /api/admin/providers/:id
// @access  Private/Admin
const getProviderById = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id)
            .select('-password -fcmTokens -fcmTokenMobile')
            .populate('vendorType', 'name')
            .lean();
        if (!provider) return res.status(404).json({ message: 'Provider not found' });
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Providers as a dropdown: a name and an id, nothing else
// @route   GET /api/admin/providers/picker
// @access  Private/Admin
// A picker used to load every provider document in full to render a list of
// names. It now asks for the two fields it draws, and has a ceiling.
const PICKER_LIMIT = 1000;
const getProviderPicker = async (req, res) => {
    try {
        const query = adminProviderScope(req.query);
        const providers = await Provider.find(query)
            .select('_id shopName ownerName')
            .sort({ shopName: 1, ownerName: 1 })
            .limit(PICKER_LIMIT)
            .lean();

        res.set('X-Total-Count', String(await Provider.countDocuments(query)));
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Counts behind the provider screens, and the cities to filter by
// @route   GET /api/admin/providers/stats
// @access  Private/Admin
// The list arrives one page at a time, so a screen counting its own rows would
// report the size of the page as the size of the business.
const getProviderStats = async (req, res) => {
    try {
        // A tab showing a count must not already be narrowed to itself, or every
        // tab would report the one that is selected. So each breakdown is taken
        // over the scope minus its own filter.
        const full = adminProviderScope(req.query, { includeSearch: false });
        const { status, ...withoutStatus } = full;
        const withoutSubscription = adminProviderScope(
            { ...req.query, subscription: undefined },
            { includeSearch: false }
        );

        const now = new Date();
        const [statusRows, subscriptionRow, cities] = await Promise.all([
            Provider.aggregate([
                { $match: withoutStatus },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Provider.aggregate([
                { $match: withoutSubscription },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        // Paying, lapsed, or never subscribed — the three the
                        // subscriptions screen groups by.
                        subscribed: {
                            $sum: {
                                $cond: [{
                                    $and: [
                                        { $eq: ['$isSubscribed', true] },
                                        { $or: [
                                            { $eq: [{ $ifNull: ['$subscriptionExpiry', null] }, null] },
                                            { $gte: ['$subscriptionExpiry', now] }
                                        ] }
                                    ]
                                }, 1, 0]
                            }
                        },
                        expired: {
                            $sum: {
                                $cond: [{
                                    $and: [
                                        { $eq: ['$isSubscribed', true] },
                                        { $ne: [{ $ifNull: ['$subscriptionExpiry', null] }, null] },
                                        { $lt: ['$subscriptionExpiry', now] }
                                    ]
                                }, 1, 0]
                            }
                        },
                        free: { $sum: { $cond: [{ $ne: ['$isSubscribed', true] }, 1, 0] } },
                        sewaks: { $sum: { $cond: [{ $eq: ['$providerCategory', 'sewak'] }, 1, 0] } },
                        partners: { $sum: { $cond: [{ $ne: ['$providerCategory', 'sewak'] }, 1, 0] } }
                    }
                }
            ]),
            // The filter dropdown offers the cities that exist, which the page
            // of rows on screen cannot know.
            Provider.distinct('city', withoutStatus)
        ]);

        const byStatus = {};
        let total = 0;
        statusRows.forEach(({ _id, count }) => {
            byStatus[_id || 'unknown'] = count;
            total += count;
        });

        const subs = subscriptionRow[0] || {};
        res.json({
            total,
            byStatus,
            verified: byStatus.verified || 0,
            pending: byStatus.pending || 0,
            rejected: byStatus.rejected || 0,
            suspended: byStatus.suspended || 0,
            subscribed: subs.subscribed || 0,
            expired: subs.expired || 0,
            free: subs.free || 0,
            sewaks: subs.sewaks || 0,
            partners: subs.partners || 0,
            cities: cities.filter(Boolean).sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update provider status (Verify/Reject)
// @route   PUT /api/admin/providers/:id/status
// @access  Private/Admin
const updateProviderStatus = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        provider.status = req.body.status || provider.status;

        // If admin verifies the provider, auto-verify current documents as well
        if (req.body.status === 'verified' && provider.documents) {
            provider.documents.forEach(doc => {
                if (doc.status === 'pending') {
                    doc.status = 'verified';
                }
            });
            provider.kycVerified = true;
        }

        const updatedProvider = await provider.save();

        // Push Notification for KYC Update
        if (req.body.status === 'verified' || req.body.status === 'rejected') {
            try {
                const { sendNotificationToUser } = require('../config/notificationService');
                const message = req.body.status === 'verified'
                    ? 'Your KYC is approved! You can start working now.'
                    : 'Your KYC request was rejected. Please check your documents.';

                await sendNotificationToUser(provider._id, 'provider', {
                    title: `KYC ${req.body.status === 'verified' ? 'Approved' : 'Rejected'}`,
                    body: message,
                    data: {
                        type: 'kyc',
                        id: provider._id.toString(),
                        link: '/provider/profile'
                    }
                });
            } catch (err) {
                console.log('Push notification failed (skipping):', err.message);
            }
        }

        // Log Verification Action
        if (req.body.status) {
            let actionType = req.body.status === 'verified' ? "VERIFY" : "REJECT";
            if (req.body.status === 'suspended') actionType = "SUSPEND";

            await AuditLog.create({
                actionType,
                entityType: provider.providerCategory === 'sewak' ? "SEWAK" : "VENDOR",
                entityId: provider._id,
                entityName: provider.shopName,
                verifiedBy: req.user._id,
                verifiedByName: req.user.name,
                verifiedByRole: req.user.role,
                details: { status: req.body.status, action: 'status_update', reason: req.body.reason }
            });

            if (req.body.status === 'suspended' && req.body.reason) {
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');
                    await sendNotificationToUser(provider._id, 'provider', {
                        title: 'Account Suspended',
                        body: `Your account has been suspended by Admin. Reason: ${req.body.reason}`,
                        data: { type: 'system', link: '/provider/profile' }
                    });
                } catch (err) {
                    console.log('Push notification for suspension failed:', err.message);
                }
            }

            // If it's a verification, also log a KYC event
            if (req.body.status === 'verified') {
                await AuditLog.create({
                    actionType: "VERIFY",
                    entityType: "KYC",
                    entityId: provider._id,
                    entityName: `${provider.ownerName} - KYC`,
                    verifiedBy: req.user._id,
                    verifiedByName: req.user.name,
                    verifiedByRole: req.user.role,
                    details: { status: 'verified' }
                });
            }
        }

        res.json(updatedProvider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update provider category role (Partner/Sewak)
// @route   PUT /api/admin/providers/:id/category-role
// @access  Private/Admin
const updateProviderCategory = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Enforce business rule: Sewak cannot be converted back to Partner
        if (provider.providerCategory === 'sewak' && req.body.providerCategory === 'partner') {
            return res.status(400).json({ message: 'Sewak providers cannot be converted back to Partner.' });
        }

        if (req.body.providerCategory !== undefined) {
            provider.providerCategory = req.body.providerCategory;
        }
        if (req.body.vendorType !== undefined && req.body.vendorType !== (provider.vendorType ? provider.vendorType.toString() : '')) {
            provider.vendorType = req.body.vendorType;
            // Retrieve subservices of the new category and assign them to the provider
            const Category = require('../models/Category');
            const newCat = await Category.findById(req.body.vendorType);
            if (newCat && newCat.services) {
                provider.subServices = newCat.services.map(s => s._id.toString());
            } else {
                provider.subServices = [];
            }
        }
        const updatedProvider = await provider.save();
        res.json(updatedProvider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = async (req, res) => {
    try {
        if (req.user.role === 'supervisor') {
            const team = await teamCodesFor(req.user._id);
            if (!team) {
                return res.json({
                    totalProviders: 0,
                    pendingProviders: 0,
                    totalUsers: 0,
                    totalBookings: 0,
                    activeBookings: 0,
                    revenue: 0,
                    recentBookings: []
                });
            }

            const teamScope = sewaksOfTeam(team.codes);
            const sewakIds = await teamSewakIds(team.codes);

            // Counted in the database rather than by loading every one of this
            // team's sewaks to look at a status field.
            const pendingSewaksCount = await Provider.countDocuments({ ...teamScope, status: 'pending' });

            const totalBookings = await Booking.countDocuments({ providerId: { $in: sewakIds } });
            const activeBookings = await Booking.countDocuments({
                providerId: { $in: sewakIds },
                status: { $in: ['pending', 'active'] }
            });

            // Same correction as the platform dashboard: `$amount` is not a
            // top-level Booking field, so this always read zero. Insta jobs
            // count too — a Sewak team may earn most of its money there.
            const revenueData = await Booking.aggregate([
                { $match: { providerId: { $in: sewakIds }, status: 'completed' } },
                { $group: { _id: null, total: { $sum: EarningsAnalyticsService.grossAggregationExpr() } } }
            ]);
            const TeamInstaJob = require('../models/InstaJob');
            const instaRevenueData = await TeamInstaJob.aggregate([
                { $match: { providerId: { $in: sewakIds }, status: { $in: ['PAYMENT_COMPLETED', 'CLOSED'] } } },
                { $group: { _id: null, total: { $sum: "$finalAmount" } } }
            ]);
            const revenue = (revenueData[0]?.total || 0) + (instaRevenueData[0]?.total || 0);

            const recentBookingsRaw = await Booking.find({ providerId: { $in: sewakIds } })
                .populate('userId', 'name')
                .populate('providerId', 'shopName')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            const recentBookings = recentBookingsRaw.map(b => ({
                id: b.bookingId || b._id.toString().slice(-6).toUpperCase(),
                user: b.userId?.name || 'Customer',
                provider: b.providerId?.shopName || 'Provider',
                service: b.serviceName || 'Service',
                amount: b.amount,
                status: b.status,
                date: new Date(b.createdAt).toLocaleDateString(),
                time: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            return res.json({
                // Counted, not measured off a list that is now capped.
                totalProviders: await Provider.countDocuments(teamScope),
                pendingProviders: pendingSewaksCount,
                // "Users" on a supervisor's dashboard means their team.
                totalUsers: team.teamSize,
                totalBookings,
                activeBookings,
                revenue,
                recentBookings
            });
        }

        // Global stats for admin/superadmin
        const totalProviders = await Provider.countDocuments();
        const pendingProviders = await Provider.countDocuments({ status: 'pending' });
        const totalUsers = await User.countDocuments();
        const totalBookings = await Booking.countDocuments();
        const activeBookings = await Booking.countDocuments({ status: { $in: ['pending', 'active'] } });

        // Revenue from completed work, bookings and Insta jobs alike.
        //
        // This summed `$amount`, which is not a top-level Booking field — only
        // a nested one — so the figure was always zero no matter how much had
        // been earned. The money lives in `totalAmount`.
        const revenueData = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: EarningsAnalyticsService.grossAggregationExpr() } } }
        ]);
        const InstaJob = require('../models/InstaJob');
        const instaRevenueData = await InstaJob.aggregate([
            { $match: { status: { $in: ['PAYMENT_COMPLETED', 'CLOSED'] } } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);
        const revenue = (revenueData[0]?.total || 0) + (instaRevenueData[0]?.total || 0);

        // Fetch Recent Bookings
        const recentBookingsRaw = await Booking.find()
            .populate('userId', 'name')
            .populate('providerId', 'shopName')
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'name mobile')
            .populate('providerId', 'shopName ownerName')
            .lean();

        const recentBookings = recentBookingsRaw.map(b => ({
            id: b.bookingId || b._id.toString().slice(-6).toUpperCase(),
            user: b.userId?.name || 'Customer',
            provider: b.providerId?.shopName || 'Provider',
            service: b.serviceName || 'Service',
            amount: b.amount,
            status: b.status,
            date: new Date(b.createdAt).toLocaleDateString(),
            time: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        res.json({
            totalProviders,
            pendingProviders,
            totalUsers,
            totalBookings,
            activeBookings,
            revenue,
            recentBookings
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Which bookings this admin may see.
 *
 * Shared by the list and by its totals: if the two built their own scope,
 * a supervisor could be shown a headline covering bookings their list does
 * not contain.
 *
 * Returns null when the user is scoped to nothing at all.
 */
const adminBookingScope = async (req, { includeSearch = false } = {}) => {
    const { status, search, city, from, to } = req.query;
    const query = {};

    // The table's "flagged" tab is a field, not a status.
    if (status === 'unauthorized') query.unauthorizedPaymentFlag = true;
    else if (status) query.status = status;

    // bookingDate is stored as "YYYY-MM-DD" (or the literal "ASAP" for an
    // express booking), which sorts lexicographically the same as
    // chronologically, so a plain string range works without parsing it.
    if (from || to) {
        query.bookingDate = {};
        if (from) query.bookingDate.$gte = String(from);
        if (to) query.bookingDate.$lte = String(to);
    }

    // A booking has no city of its own — the provider serving it does.
    let cityProviderIds = null;
    if (city && city !== 'all') {
        const escapeRx = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cityProviders = await Provider.find({ city: new RegExp(`^${escapeRx(city)}$`, 'i') })
            .select('_id').lean();
        cityProviderIds = cityProviders.map(p => p._id);
        query.providerId = { $in: cityProviderIds };
    }

    // Searching used to happen in the browser over whatever rows it held, which
    // meant a search only ever found what had already been sent. It reaches the
    // customer and the provider as well as the booking, so those are resolved to
    // ids first — both are far smaller collections than bookings.
    if (includeSearch && search && String(search).trim()) {
        const term = String(search).trim();
        const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const [users, providers] = await Promise.all([
            User.find({ $or: [{ name: rx }, { mobile: rx }] }).select('_id').limit(500).lean(),
            Provider.find({ $or: [{ shopName: rx }, { ownerName: rx }] }).select('_id').limit(500).lean()
        ]);

        const or = [
            { serviceName: rx },
            { userId: { $in: users.map(u => u._id) } },
            { providerId: { $in: providers.map(p => p._id) } }
        ];

        // A booking is searched by the short code the table shows, which is the
        // tail of its id — so only a full id can be matched exactly.
        if (mongoose.Types.ObjectId.isValid(term)) or.push({ _id: new mongoose.Types.ObjectId(term) });

        query.$or = or;
    }

    if (req.user.role === 'supervisor') {
        const team = await teamCodesFor(req.user._id);
        // No employee record means no team, which means nothing to see —
        // not everything.
        if (!team) return null;
        const teamProviderIds = await teamSewakIds(team.codes);
        // A city filter already narrowed providerId above — intersect rather
        // than overwrite, or a supervisor could be shown another team's city.
        query.providerId = { $in: cityProviderIds
            ? teamProviderIds.filter(id => cityProviderIds.some(cid => cid.equals(id)))
            : teamProviderIds };
    }

    return query;
};

// @desc    Get all bookings for admin
// @route   GET /api/admin/bookings
// @access  Private/Admin
/**
 * The figures above the bookings table: totals, revenue, and the count on each
 * filter tab.
 *
 * These used to be derived in the browser from the array it had been sent. That
 * was only ever right because the array was every booking ever made — so the
 * moment that list was paged, the headline silently became "the last 200", and
 * the revenue figure with it. They belong here, over the whole scope, where
 * they are both correct and cheap.
 */
const getBookingStats = async (req, res) => {
    try {
        const query = await adminBookingScope(req);
        if (!query) return res.json({ total: 0, revenue: 0, statusCounts: {}, cities: [] });

        // Revenue is the completed bookings *within* the current scope. Spreading
        // `status: 'completed'` over the scope would overwrite a status filter
        // instead of narrowing it — so filtering the table to cancelled still
        // reported the revenue of every completed booking on the platform.
        const scopedToOtherStatus = query.status && query.status !== 'completed';
        const revenueMatch = { ...query, status: 'completed' };

        const [byStatus, revenueRow, unauthorized, cities] = await Promise.all([
            Booking.aggregate([
                { $match: query },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            scopedToOtherStatus ? [] : Booking.aggregate([
                { $match: revenueMatch },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }
            ]),
            Booking.countDocuments({ ...query, unauthorizedPaymentFlag: true }),
            // The city filter's options, which the page of rows on screen cannot know.
            Provider.distinct('city')
        ]);

        const statusCounts = {};
        let total = 0;
        byStatus.forEach(r => {
            statusCounts[r._id] = r.count;
            total += r.count;
        });
        statusCounts.all = total;

        const inFlight = ['pending', 'confirmed', 'on_the_way', 'started'];

        res.json({
            total,
            completed: statusCounts.completed || 0,
            active: inFlight.reduce((sum, s) => sum + (statusCounts[s] || 0), 0),
            cancelled: statusCounts.cancelled || 0,
            unauthorized,
            revenue: Math.round((revenueRow[0]?.revenue || 0) * 100) / 100,
            statusCounts,
            cities: cities.filter(Boolean).sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBookings = async (req, res) => {
    try {
        // The list narrows to what was searched for; the figures above it do not,
        // so the cards keep describing the whole scope while the table answers
        // the question that was typed.
        const query = await adminBookingScope(req, { includeSearch: true });
        if (!query) return res.json([]);

        // Every booking ever made, populated and returned whole, was the
        // heaviest read in the admin panel. Newest first and bounded; a
        // caller that needs further back asks for the next page.
        const bookings = await paginate(
            Booking.find(query)
                .populate('userId', 'name email mobile')
                .populate('providerId', 'shopName ownerName mobile')
                .sort({ createdAt: -1 }),
            pageParams(req)
        );

        // How many there really are, and what they come to, so a screen showing
        // a page can still say so. Sent as headers because several callers
        // expect a bare array.
        const [count, [value]] = await Promise.all([
            Booking.countDocuments(query),
            Booking.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        ]);
        res.set('X-Total-Count', String(count));
        res.set('X-Total-Value', String(Math.round((value?.total || 0) * 100) / 100));
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a booking
// @route   DELETE /api/admin/bookings/:id
// @access  Private/Admin
const deleteBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        await Booking.findByIdAndDelete(req.params.id);

        // Log Action
        await AuditLog.create({
            actionType: "DELETE",
            entityType: "BOOKING",
            entityId: booking._id,
            entityName: `Booking #${booking._id.toString().slice(-6)}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'delete_booking' }
        });

        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all provider reports/disputes
// @route   GET /api/admin/provider-reports
// @access  Private/Admin
const getProviderReports = async (req, res) => {
    try {
        // Fetch all bookings where adminRequest.status is 'pending'
        // A queue that is meant to drain, but nothing guarantees it does.
        const reports = await paginate(
            Booking.find({ 'adminRequest.status': 'pending' })
                .populate('userId', 'name email mobile')
                .populate('providerId', 'shopName ownerName mobile')
                .sort({ 'adminRequest.requestedAt': -1 }),
            pageParams(req)
        );
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resolve provider report
// @route   PATCH /api/admin/provider-reports/:id/resolve
// @access  Private/Admin
const resolveProviderReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { actionTaken, notes, blockUser } = req.body;

        const booking = await Booking.findById(id).populate('userId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        booking.adminRequest.status = 'resolved';
        // Add notes if needed later via AuditLog or inside adminRequest
        await booking.save();

        if (blockUser && booking.userId) {
            booking.userId.isActive = false;
            await booking.userId.save();
        }

        // Log the resolution
        await AuditLog.create({
            actionType: "RESOLVE_DISPUTE",
            entityType: "BOOKING",
            entityId: booking._id,
            entityName: `Dispute Resolution for Booking #${booking._id.toString().slice(-6)}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { actionTaken, notes, blockedUser: blockUser }
        });

        res.json({ message: 'Report resolved successfully', booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Service = require('../models/Service');
const Combo = require('../models/Combo');
const ServiceCatalogService = require('../services/ServiceCatalogService');

// @desc    Get all categories with dynamically merged services
// @route   GET /api/admin/categories
// @access  Private/Admin
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ index: 1 }).lean();
        const catIds = categories.map(c => c._id);

        const subcategories = await Subcategory.find({ categoryId: { $in: catIds } }).select('_id categoryId name').lean();
        const subMap = {};
        const subIds = [];
        subcategories.forEach(sub => {
            if (sub.categoryId) {
                subMap[sub._id.toString()] = sub.categoryId.toString();
            }
            subIds.push(sub._id);
        });

        const services = await Service.find({
            $or: [
                { categoryId: { $in: catIds } },
                { subcategoryId: { $in: subIds } }
            ]
        }).lean();

        const servicesByCat = {};
        services.forEach(svc => {
            let catIdStr = svc.categoryId ? svc.categoryId.toString() : (svc.subcategoryId ? subMap[svc.subcategoryId.toString()] : null);
            if (catIdStr) {
                if (!servicesByCat[catIdStr]) servicesByCat[catIdStr] = [];
                servicesByCat[catIdStr].push(svc);
            }
        });

        const result = categories.map(cat => {
            const catIdStr = cat._id.toString();
            const dbServices = servicesByCat[catIdStr] || [];
            const embeddedServices = cat.services || [];

            const combinedMap = new Map();

            embeddedServices.forEach(s => {
                const key = (s._id && s._id.toString()) || s.name;
                combinedMap.set(key, {
                    _id: s._id,
                    name: s.name,
                    basePrice: Number(s.basePrice) || 0,
                    offerPrice: Number(s.offerPrice) || 0,
                    description: s.description || ""
                });
            });

            dbServices.forEach(s => {
                const key = s._id ? s._id.toString() : s.name;
                const existingKey = Array.from(combinedMap.keys()).find(k => k === key || combinedMap.get(k)?.name === s.name);
                const existing = existingKey ? combinedMap.get(existingKey) : null;

                const serviceItem = {
                    _id: s._id,
                    name: s.name,
                    basePrice: s.price !== undefined ? Number(s.price) : (existing?.basePrice || 0),
                    // Standalone Service docs don't track offerPrice — it only
                    // lives on the embedded copy, so carry it over as-is.
                    offerPrice: existing?.offerPrice || 0,
                    description: s.description || existing?.description || "",
                    subcategoryId: s.subcategoryId,
                    subcategory: s.subcategory
                };

                if (existingKey) {
                    combinedMap.set(existingKey, serviceItem);
                } else {
                    combinedMap.set(key, serviceItem);
                }
            });

            return {
                ...cat,
                services: Array.from(combinedMap.values())
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new category
// @route   POST /api/admin/categories
// @access  Private/Admin
const addCategory = async (req, res) => {
    try {
        const category = await Category.create(req.body);
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found' });

        if (req.body.name !== undefined) category.name = req.body.name;
        if (req.body.description !== undefined) category.description = req.body.description;
        if (req.body.icon !== undefined) category.icon = req.body.icon;
        if (req.body.image !== undefined) category.image = req.body.image;
        if (req.body.isActive !== undefined) category.isActive = req.body.isActive;
        if (req.body.isComingSoon !== undefined) category.isComingSoon = req.body.isComingSoon;
        if (req.body.businessModel !== undefined) category.businessModel = req.body.businessModel;
        if (['sewak', 'partner', 'both'].includes(req.body.visibleTo)) category.visibleTo = req.body.visibleTo;
        if (req.body.defaultLeadPrice !== undefined) category.defaultLeadPrice = req.body.defaultLeadPrice;
        if (req.body.gstPercent !== undefined) category.gstPercent = req.body.gstPercent;
        if (req.body.platformFee !== undefined) category.platformFee = req.body.platformFee;

        if (req.body.services) {
            // Removing an entry here only edits the embedded catalog copy — the
            // public listing is driven primarily by standalone Service documents
            // (see getPublicServicesBySubcategory), which silently survived a
            // deletion made from this "embedded" editor. Diff against the old
            // list and delete the matching standalone doc(s) too, so a service
            // removed here actually disappears from the customer app.
            const oldServices = category.services || [];
            const stillPresent = new Set(
                req.body.services.map(s => (s._id ? String(s._id) : null)).filter(Boolean)
            );
            const stillPresentNames = new Set(req.body.services.map(s => s.name));
            const removed = oldServices.filter(s =>
                !(s._id && stillPresent.has(String(s._id))) && !stillPresentNames.has(s.name)
            );
            for (const r of removed) {
                // Delete the standalone catalog doc(s)...
                const removeQuery = r._id
                    ? { $or: [{ _id: r._id }, { categoryId: category._id, name: r.name }] }
                    : { categoryId: category._id, name: r.name };
                await Service.deleteMany(removeQuery);

                // ...then every denormalised copy. The query above only reaches
                // docs carrying `categoryId`, which a partner's own copy never
                // sets (createService writes `category`), so those copies —
                // and the provider's selected services and combos — survived
                // and kept the removed service visible to customers.
                await ServiceCatalogService.cascadeServiceRemoval({
                    serviceId: r._id,
                    serviceName: r.name,
                    categoryId: category._id
                });
            }

            category.services = req.body.services.map(s => {
                const existing = category.services.find(sub => (sub._id && s._id && sub._id.toString() === s._id.toString()) || sub.name === s.name);
                const pick = (key, fallback) => (s[key] !== undefined ? s[key] : (existing?.[key] !== undefined ? existing[key] : fallback));
                return {
                    _id: existing?._id || s._id || new mongoose.Types.ObjectId(),
                    name: s.name,
                    basePrice: Number(s.basePrice) || 0,
                    offerPrice: Number(pick('offerPrice', 0)) || 0,
                    description: s.description || existing?.description || "",
                    image: pick('image', ""),
                    skillSessionRequired: !!pick('skillSessionRequired', false),
                    sessionDurationMinutes: Number(pick('sessionDurationMinutes', 60)) || 60,
                    sessionMode: pick('sessionMode', 'offline'),
                    skillSessionActive: pick('skillSessionActive', true) !== false,
                    visibleTo: ['sewak', 'partner', 'both'].includes(pick('visibleTo', 'both')) ? pick('visibleTo', 'both') : 'both'
                };
            });
            category.markModified('services');

            for (const s of req.body.services) {
                // Mirror the Skill Session config onto the standalone Service docs so the
                // gate reads the same values whichever surface it is checked from.
                const saved = category.services.find(sub => sub.name === s.name) || {};
                const skillFields = {
                    skillSessionRequired: !!saved.skillSessionRequired,
                    sessionDurationMinutes: Number(saved.sessionDurationMinutes) || 60,
                    sessionMode: saved.sessionMode || 'offline',
                    skillSessionActive: saved.skillSessionActive !== false,
                    visibleTo: saved.visibleTo || 'both'
                };
                if (s._id && mongoose.Types.ObjectId.isValid(s._id)) {
                    await Service.findByIdAndUpdate(s._id, {
                        price: Number(s.basePrice) || 0,
                        name: s.name,
                        description: s.description || "",
                        ...skillFields
                    });
                }
                await Service.updateMany(
                    { categoryId: category._id, name: s.name },
                    { price: Number(s.basePrice) || 0, ...skillFields }
                );
            }
        }
        if (req.body.combos) {
            category.combos = req.body.combos.map(c => {
                const existing = category.combos.find(cb => (cb._id && c._id && cb._id.toString() === c._id.toString()) || cb.name === c.name);
                return {
                    _id: existing?._id || c._id || new mongoose.Types.ObjectId(),
                    name: c.name,
                    description: c.description || existing?.description || "",
                    services: c.services || [],
                    sewakPrice: Number(c.sewakPrice) || 0,
                    image: c.image || existing?.image || ""
                };
            });
            category.markModified('combos');
        }
        const updated = await category.save();

        // Synchronize provider subServices for all providers in this category
        if (req.body.services) {
            try {
                const serviceIds = updated.services.map(s => s._id.toString());
                await Provider.updateMany(
                    { vendorType: updated._id },
                    { $set: { subServices: serviceIds } }
                );
                console.log(`[AdminController] Auto-synchronized subServices for providers in category ${updated.name}`);
            } catch (err) {
                console.error('[AdminController] Failed to sync provider subServices:', err);
            }
        }

        // If Sewak pricing fields are present in services, sync them across all Sewak providers
        if (req.body.services) {
            try {
                const sewaks = await Provider.find({ providerCategory: 'sewak' }).select('_id');
                const sewakIds = sewaks.map(s => s._id);

                if (sewakIds.length > 0) {
                    for (const sub of updated.services) {
                        await Service.updateMany(
                            {
                                providerId: { $in: sewakIds },
                                name: sub.name,
                                category: updated.name
                            },
                            {
                                $set: {
                                    price: sub.basePrice ?? 299
                                }
                            }
                        );
                    }

                    // Sync Combo Pricing
                    if (updated.combos && updated.combos.length > 0) {
                        for (const comboTemplate of updated.combos) {
                            await Combo.updateMany(
                                {
                                    providerId: { $in: sewakIds },
                                    name: comboTemplate.name
                                },
                                {
                                    $set: { price: comboTemplate.sewakPrice || 0 }
                                }
                            );
                        }
                    }
                }
            } catch (syncError) {
                console.error("Failed to sync sewak prices:", syncError);
                // We don't fail the whole request, but log the error
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Cascade-clean dependents that hold a hard ObjectId reference to this
        // category. Left orphaned, these silently stop matching anything (a
        // CommissionSlab tied to a deleted category can never be resolved by
        // CategorySlabStrategy again, and its Admin UI can never display the
        // category either since it no longer exists) — this is exactly what
        // produced the "category keeps disappearing" bug in Partner Program.
        const CommissionSlab = require('../models/CommissionSlab');
        const slabDeletion = await CommissionSlab.deleteMany({ category: categoryId });

        // Subscription plans just fall back to "Global (All Categories)"
        // rather than being deleted outright, since the plan itself (price,
        // benefits, active subscribers) is still valid without a category.
        const planUpdate = await SubscriptionPlan.updateMany(
            { category: categoryId },
            { $set: { category: null } }
        );

        await Category.findByIdAndDelete(categoryId);

        res.json({
            message: 'Category removed',
            cleanedUp: {
                commissionSlabsDeleted: slabDeletion.deletedCount,
                subscriptionPlansUnlinked: planUpdate.modifiedCount
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users for admin
// @route   GET /api/admin/users
// @access  Private/Admin
// What an admin screen is asking for when it asks for users. Shared with the
// stats below so a card's count and the rows under it describe the same set.
const adminUserScope = (params, { includeSearch = true } = {}) => {
    // Correcting the role factor: default role in User model is 'customer'
    const query = { role: 'customer' };

    if (params.status === 'active') query.isActive = { $ne: false };
    else if (params.status === 'blocked') query.isActive = false;

    const escape = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
    if (params.city && params.city !== 'all') query.city = new RegExp(`^${escape(params.city)}$`, 'i');

    // The joined-on range, as the screen's two date pickers describe it.
    const { from, to } = params;
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
        if (to) query.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const term = String(includeSearch ? (params.search || '') : '').trim();
    if (term) {
        const rx = new RegExp(escape(term), 'i');
        query.$or = [{ name: rx }, { mobile: rx }, { email: rx }];
    }

    return query;
};

const getUsers = async (req, res) => {
    try {
        const query = adminUserScope(req.query);
        const users = await paginate(
            User.find(query).select('-password').sort({ createdAt: -1 }),
            pageParams(req)
        );

        res.set('X-Total-Count', String(await User.countDocuments(query)));
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Counts behind the users screen
// @route   GET /api/admin/users/stats
// @access  Private/Admin
// The table arrives one page at a time, so counting its rows would report the
// size of the page as the size of the customer base.
const getUserStats = async (req, res) => {
    try {
        // Not narrowed by the status tab: each tab shows its own count.
        const scope = adminUserScope({ ...req.query, status: undefined }, { includeSearch: false });

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        // Every customer's wallet, joined and summed here rather than fetched
        // and totalled on the page — the user list arrives one page at a
        // time, so adding up the rows in hand would report the balance of
        // whichever twenty customers happened to be on screen.
        const [rows, cities] = await Promise.all([
            User.aggregate([
                { $match: scope },
                {
                    $lookup: {
                        from: 'wallets',
                        localField: '_id',
                        foreignField: 'userId',
                        as: 'wallet'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: { $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] } },
                        blocked: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } },
                        recent: { $sum: { $cond: [{ $gte: ['$createdAt', weekAgo] }, 1, 0] } },
                        totalWalletBalance: { $sum: { $ifNull: [{ $first: '$wallet.balance' }, 0] } }
                    }
                }
            ]),
            // The filter dropdown offers the cities that exist, which the page
            // of rows on screen cannot know.
            User.distinct('city', scope)
        ]);
        const row = rows[0];

        res.json({
            total: row?.total || 0,
            active: row?.active || 0,
            blocked: row?.blocked || 0,
            recent: row?.recent || 0,
            totalWalletBalance: Math.round((row?.totalWalletBalance || 0) * 100) / 100,
            cities: cities.filter(Boolean).sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle User (Customer) Block/Unblock
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isActive = user.isActive === false ? true : false;
        await user.save();

        // Log Action
        await AuditLog.create({
            actionType: user.isActive ? "UNBLOCK" : "BLOCK",
            entityType: "USER",
            entityId: user._id,
            entityName: user.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: user.isActive ? 'active' : 'blocked' }
        });

        res.json({ success: true, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete User
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await User.findByIdAndDelete(req.params.id);

        // Log Action
        await AuditLog.create({
            actionType: "DELETE",
            entityType: "USER",
            entityId: user._id,
            entityName: user.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'delete_user' }
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Banner = require('../models/Banner');

// @desc    Get all banners
// @route   GET /api/admin/banners
// @access  Private/Admin
const getBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ priority: -1 });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new banner
// @route   POST /api/admin/banners
// @access  Private/Admin
const addBanner = async (req, res) => {
    try {
        const banner = await Banner.create(req.body);
        res.status(201).json(banner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete banner
// @route   DELETE /api/admin/banners/:id
// @access  Private/Admin
const deleteBanner = async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ message: 'Banner removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update banner
// @route   PUT /api/admin/banners/:id
// @access  Private/Admin
const updateBanner = async (req, res) => {
    try {
        const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(banner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload a short banner video (< 10MB)
// @route   POST /api/admin/banners/upload-video
// @access  Private/Admin
const uploadBannerVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No video file provided' });
        }

        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: 'Video file size must be less than 10MB' });
        }

        const { cloudinary } = require('../config/cloudinary');

        const uploadFromBuffer = (fileBuffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'rojsewa/banners', resource_type: 'video' },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(fileBuffer);
            });
        };

        const result = await uploadFromBuffer(req.file.buffer);
        res.json({ url: result.secure_url });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle banner status
// @route   PATCH /api/admin/banners/:id/status
// @access  Private/Admin
const toggleBannerStatus = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: 'Banner not found' });

        banner.active = !banner.active;
        const updated = await banner.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Emergency Dashboard Data
// @route   GET /api/admin/emergency
// @access  Private/Admin
const getEmergencyData = async (req, res) => {
    try {
        const EmergencyAlert = require('../models/EmergencyAlert');
        // Actual SOS Alerts from Providers
        const activeSOS = await EmergencyAlert.find({ status: 'pending' })
            .populate('providerId', 'shopName ownerName profileImage mobile')
            .sort({ createdAt: -1 });

        const incomingSOSCount = activeSOS.length;
        const activeResponders = await Provider.countDocuments({ status: 'verified', isOnline: true });

        const responderStatus = await Provider.find({ status: 'verified' })
            .select('shopName address isOnline businessType')
            .limit(10);

        res.json({
            incomingSOS: incomingSOSCount,
            activeResponders,
            sosQueue: activeSOS, // Use actual SOS alerts here
            responderStatus
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Broadcast SOS to all active providers
// @route   POST /api/admin/emergency/broadcast
// @access  Private/Admin
const broadcastEmergency = async (req, res) => {
    try {
        const { message } = req.body;
        // Logic to notify providers (via socket or push notification)
        // For now, we simulate the broadcast success
        const activeRespondersCount = await Provider.countDocuments({ status: 'verified', isOnline: true });

        res.json({
            success: true,
            message: `Emergency broadcast sent to ${activeRespondersCount} active responders.`,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get 99 Card Management Data
// @route   GET /api/admin/99cards
// @access  Private/Admin
const get99CardData = async (req, res) => {
    try {
        const Setting = require('../models/Setting');
        const [cardPriceSetting, validitySetting] = await Promise.all([
            Setting.findOne({ key: 'vendorCardPrice' }),
            Setting.findOne({ key: 'vendorCardValidityDays' })
        ]);
        const cardPrice = cardPriceSetting ? parseFloat(cardPriceSetting.value) : 99;
        const cardValidityDays = validitySetting ? parseInt(validitySetting.value, 10) : 365;

        const { city, from, to, cardStatus } = req.query;
        const query = {};

        if (city && city !== 'all') {
            const escapeRx = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.city = new RegExp(`^${escapeRx(city)}$`, 'i');
        }

        // Registration date, as the two date pickers on the screen describe it.
        if (from || to) {
            query.joinedDate = {};
            if (from) query.joinedDate.$gte = new Date(new Date(from).setHours(0, 0, 0, 0));
            if (to) query.joinedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }

        // A card with no expiry recorded predates this field and is treated as
        // still active rather than silently counted as expired.
        const now = new Date();
        if (cardStatus === 'active') {
            query.$and = (query.$and || []).concat([
                { $or: [{ vendorCardExpiry: null }, { vendorCardExpiry: { $gte: now } }] }
            ]);
        } else if (cardStatus === 'expired') {
            query.vendorCardExpiry = { $lt: now };
        }

        const [totalSales, activeSubscribers, totalExpired, cities, recentActivations] = await Promise.all([
            Provider.countDocuments(query),
            Provider.countDocuments({ ...query, status: 'verified' }),
            // Expired count describes the same city/date scope, independent of
            // whichever card-status tab is currently selected.
            Provider.countDocuments({ ...query, vendorCardExpiry: { $lt: now } }),
            Provider.distinct('city'),
            Provider.find(query)
                .select('ownerName shopName city joinedDate vendorCode employeeCode freeServicesLeft referredBy vendorCardExpiry')
                .sort({ joinedDate: -1 })
                .limit(10)
        ]);

        res.json({
            totalSales,
            activeSubscribers,
            totalExpired,
            totalRevenue: totalSales * cardPrice,
            recentActivations,
            cardPrice, // Send card price to frontend too
            cardValidityDays,
            cities: cities.filter(Boolean).sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Feedback/Review Data
// @route   GET /api/admin/feedback
// @access  Private/Admin
const getFeedbackData = async (req, res) => {
    try {
        // Every review ever left, on one screen.
        const reviews = await paginate(
            Booking.find({ rating: { $gt: 0 } })
                .populate('userId', 'name')
                .populate('providerId', 'shopName providerCategory')
                .sort({ createdAt: -1 }),
            pageParams(req)
        );

        // Transform for frontend
        const mappedReviews = reviews.map(r => ({
            id: r._id,
            author: r.userId?.name || 'Customer',
            role: 'user', // Default to user for now as schema supports one rating
            rating: r.rating,
            date: new Date(r.createdAt).toISOString().split('T')[0],
            comment: r.comment || 'No comment provided.',
            tags: r.rating >= 4 ? ['Good Service'] : ['Needs Attention'],
            provider: r.providerId?.shopName || 'Provider',
            // Who the feedback is about, not who left it — Partner unless the
            // provider is explicitly a Sewak, same default as the Provider model.
            providerCategory: r.providerId?.providerCategory === 'sewak' ? 'sewak' : 'partner',
            acknowledged: false // This could be stored in DB later if needed
        }));

        res.json(mappedReviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Activity Logs
// @route   GET /api/admin/activity
// @access  Private/Admin
const getActivityLogs = async (req, res) => {
    try {
        const recentProviders = await Provider.find().sort({ joinedDate: -1 }).limit(10);
        const recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(10);

        const providerLogs = recentProviders.map(p => ({
            type: 'approval',
            action: `New Provider '${p.shopName}' reached out`,
            user: p.ownerName,
            time: p.joinedDate
        }));

        const bookingLogs = recentBookings.map(b => ({
            type: 'login',
            action: `Booking for ${b.serviceName} was placed`,
            user: 'System',
            time: b.createdAt
        }));

        const allLogs = [...providerLogs, ...bookingLogs].sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json(allLogs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    System Login Report — city-wise, date-wise and time-of-day-wise
// @route   GET /api/admin/login-logs
// @access  Private/Admin
const getLoginLogs = async (req, res) => {
    try {
        const { city, dateFrom, dateTo, timeFrom, timeTo } = req.query;

        const match = {};
        if (city && city !== 'all') {
            const escapeRx = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            match.city = new RegExp(`^${escapeRx(city)}$`, 'i');
        }
        if (dateFrom || dateTo) {
            match.createdAt = {};
            if (dateFrom) match.createdAt.$gte = new Date(new Date(dateFrom).setHours(0, 0, 0, 0));
            if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); match.createdAt.$lte = d; }
        }

        const { page, limit } = pageParams(req);

        // Time-of-day (e.g. "logins between 21:00 and 23:00", any date) needs
        // the hour:minute of the login itself, in IST — createdAt is UTC and
        // a raw date range can't express "this time, every day" on its own.
        if (timeFrom || timeTo) {
            const pipeline = [
                { $match: match },
                { $addFields: { hhmm: { $dateToString: { format: '%H:%M', date: '$createdAt', timezone: '+05:30' } } } }
            ];
            const timeMatch = {};
            if (timeFrom) timeMatch.$gte = timeFrom;
            if (timeTo) timeMatch.$lte = timeTo;
            pipeline.push({ $match: { hhmm: timeMatch } });

            const countPipeline = [...pipeline, { $count: 'total' }];
            pipeline.push({ $sort: { createdAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit });

            const [logs, countResult] = await Promise.all([
                LoginLog.aggregate(pipeline),
                LoginLog.aggregate(countPipeline)
            ]);
            res.set('X-Total-Count', String(countResult[0]?.total || 0));
            return res.json(logs);
        }

        const [logs, total] = await Promise.all([
            paginate(LoginLog.find(match).sort({ createdAt: -1 }), pageParams(req)),
            LoginLog.countDocuments(match)
        ]);
        res.set('X-Total-Count', String(total));
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cities that appear in the login log, for the filter dropdown
// @route   GET /api/admin/login-logs/cities
// @access  Private/Admin
const getLoginLogCities = async (req, res) => {
    try {
        const cities = await LoginLog.distinct('city');
        res.json(cities.filter(Boolean).sort());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Global Settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        const settings = await Setting.find();
        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        // Return with defaults if first time
        res.json({
            emergencyEnabled: config.emergencyEnabled !== undefined ? (config.emergencyEnabled === 'true' || config.emergencyEnabled === true) : true,
            autoAssign: config.autoAssign !== undefined ? (config.autoAssign === 'true' || config.autoAssign === true) : true,
            vendorCardEnabled: config.vendorCardEnabled !== undefined ? (config.vendorCardEnabled === 'true' || config.vendorCardEnabled === true) : true,
            vendorCardPrice: config.vendorCardPrice || 99,
            vendorCardValidityDays: config.vendorCardValidityDays || 365,
            // New Tiered Commission Keys
            commission_basic: config.commission_basic || 25,
            commission_standard: config.commission_standard || 20,
            commission_premium: config.commission_premium || 15,
            // Subscriptions
            subscription_price: config.subscription_price || 999,
            subscription_commission_rate: config.subscription_commission_rate || 5,
            subscription_enabled: config.subscription_enabled !== undefined ? (config.subscription_enabled === 'true' || config.subscription_enabled === true) : true,
            terms: config.terms || "Standard Terms",
            privacy: config.privacy || "Standard Privacy",
            cancellation: config.cancellation || "Standard Cancellation",
            // Lead Model settings
            lead_min_wallet_balance: config.lead_min_wallet_balance || 200,
            lead_unlock_price: config.lead_unlock_price || 50,
            lead_free_unlock_limit: config.lead_free_unlock_limit !== undefined ? Number(config.lead_free_unlock_limit) : 3,
            lead_max_unlock_count: config.lead_max_unlock_count || 3,
            lead_geofence_radius: config.lead_geofence_radius || 15,
            lead_expiry: config.lead_expiry || 24,
            lead_dispute_enabled: config.lead_dispute_enabled !== undefined ? (config.lead_dispute_enabled === 'true' || config.lead_dispute_enabled === true) : true,
            lead_refund_enabled: config.lead_refund_enabled !== undefined ? (config.lead_refund_enabled === 'true' || config.lead_refund_enabled === true) : true,
            lead_pay_per_lead_enabled: config.lead_pay_per_lead_enabled !== undefined ? (config.lead_pay_per_lead_enabled === 'true' || config.lead_pay_per_lead_enabled === true) : true,
            provider_banner_plans: config.provider_banner_plans,
            provider_banner_durations: config.provider_banner_durations,
            adminProfile: {
                name: req.user.name,
                email: req.user.email,
                mobile: req.user.mobile
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Global Settings
// @route   POST /api/admin/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const { key, value } = req.body;

        const preSetting = await Setting.findOne({ key });
        const oldValue = preSetting ? preSetting.value : null;

        await Setting.findOneAndUpdate(
            { key },
            { value, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        // Audit Log entry
        await AuditLog.create({
            actionType: 'ADMIN_SETTING_UPDATE',
            entityType: 'LEAD_SETTING',
            entityId: new mongoose.Types.ObjectId(),
            entityName: `Config setting updated: ${key}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || "Admin",
            verifiedByRole: req.user.role || "admin",
            details: {
                key,
                oldValue,
                newValue: value
            }
        });

        res.json({ success: true, message: `${key} updated` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Admin Profile
// @route   POST /api/admin/profile
// @access  Private/Admin
const updateAdminProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.mobile = req.body.mobile || user.mobile;
            await user.save();
            res.json({ success: true, message: "Profile updated" });
        } else {
            res.status(404).json({ message: "Admin not found" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const Promotion = require('../models/Promotion');

// @desc    Get all promotions
// @route   GET /api/admin/promotions
// @access  Private/Admin
async function getPromotions(req, res) {
    try {
        const promotions = await Promotion.find().sort({ createdAt: -1 });
        res.json(promotions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Create a promotion
// @route   POST /api/admin/promotions
// @access  Private/Admin
async function createPromotion(req, res) {
    try {
        const { title, promoCode, description } = req.body;
        const exists = await Promotion.findOne({ promoCode: promoCode.toUpperCase() });
        if (exists) return res.status(400).json({ message: 'Promo code already exists' });

        const promotion = await Promotion.create({
            title,
            promoCode: promoCode.toUpperCase(),
            description
        });
        res.status(201).json(promotion);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Delete a promotion
// @route   DELETE /api/admin/promotions/:id
// @access  Private/Admin
async function deletePromotion(req, res) {
    try {
        await Promotion.findByIdAndDelete(req.params.id);
        res.json({ message: 'Promotion removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const Zone = require('../models/Zone');

// @desc    Get all zones
// @route   GET /api/admin/zones
// @access  Private/Admin
async function getZones(req, res) {
    try {
        const zones = await Zone.find().sort({ createdAt: -1 });
        res.json(zones);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Add new zone
// @route   POST /api/admin/zones
// @access  Private/Admin
async function addZone(req, res) {
    try {
        const zone = await Zone.create(req.body);
        res.status(201).json(zone);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "A zone with this name already exists." });
        }
        res.status(400).json({ message: "Invalid zone details. Please check your inputs." });
    }
}

// @desc    Delete zone
// @route   DELETE /api/admin/zones/:id
// @access  Private/Admin
async function deleteZone(req, res) {
    try {
        await Zone.findByIdAndDelete(req.params.id);
        res.json({ message: 'Zone removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private/Admin
/**
 * Which employees this admin may see. A supervisor sees their own team; an
 * admin sees everyone. Shared with the stats below so a card's count and the
 * rows under it can never describe two different sets.
 */
const employeeScope = async (req, { includeStatus = true, includeSearch = true } = {}) => {
    const { status, view, role, city, supervisorCode } = req.query;
    let query = includeStatus && status ? { status } : {};

    // The screen shows supervisors and everyone else as two separate tables.
    if (view === 'supervisor') query.role = 'supervisor';
    else if (view === 'employee') query.role = { $ne: 'supervisor' };
    if (role && role !== 'all') query.role = role;

    if (city && city !== 'all') query.city = city;
    if (supervisorCode && supervisorCode !== 'all') query.supervisorCode = supervisorCode;

    // Searching in the browser could only ever find what had already been sent,
    // which on a paged list is one page.
    const term = String(includeSearch ? (req.query.search || '') : '').trim();
    if (term) {
        const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c), 'i');
        query.$and = (query.$and || []).concat([{
            $or: [{ name: rx }, { email: rx }, { mobile: rx }, { ownCode: rx }, { city: rx }, { supervisorCode: rx }]
        }]);
    }

    if (req.user.role === 'supervisor') {
        const supervisorEmp = await Employee.findOne({ userId: req.user._id }).select("_id").lean();
        query = supervisorEmp
            ? { ...query, $or: [{ managedBy: supervisorEmp._id }, { createdBy: req.user._id }] }
            : { ...query, createdBy: req.user._id };
    }

    return query;
};

// @desc    Counts behind the HRM screen
// @route   GET /api/admin/employees/stats
// @access  Private/Supervisor
// The table arrives one page at a time, so counting its rows would report the
// size of the page as the size of the staff.
async function getEmployeeStats(req, res) {
    try {
        // Not narrowed by the status filter or the view, since the cards count
        // both groups, and not by the search, so they keep describing the staff
        // while the table answers what was typed.
        const scope = await employeeScope(
            { ...req, query: { ...req.query, view: undefined, role: undefined } },
            { includeStatus: false, includeSearch: false }
        );

        const rows = await Employee.aggregate([
            { $match: scope },
            {
                $group: {
                    _id: { role: '$role', status: '$status' },
                    n: { $sum: 1 }
                }
            }
        ]);

        // The screen splits staff into supervisors and everyone else, and shows
        // a different set of cards for each.
        const supervisor = { total: 0, verified: 0, pending: 0 };
        const staff = { total: 0, fieldStaff: 0, employees: 0, pending: 0 };

        rows.forEach(({ _id, n }) => {
            const isSupervisor = _id.role === 'supervisor';
            const bucket = isSupervisor ? supervisor : staff;
            bucket.total += n;
            if (_id.status === 'pending') bucket.pending += n;
            if (isSupervisor) {
                if (_id.status === 'verified') supervisor.verified += n;
            } else {
                if (_id.role === 'field_staff') staff.fieldStaff += n;
                if (_id.role === 'employee') staff.employees += n;
            }
        });

        // The dropdowns offer the cities and supervisors that exist, which one
        // page of rows cannot know.
        const [cities, supervisors] = await Promise.all([
            Employee.distinct('city', scope),
            Employee.distinct('supervisorCode', scope)
        ]);

        res.json({
            supervisor,
            staff,
            cities: cities.filter(Boolean).sort(),
            supervisors: supervisors.filter(Boolean).sort()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function getEmployees(req, res) {
    try {
        const query = await employeeScope(req);

        const employees = await paginate(
            Employee.find(query)
                .populate('userId')
                .populate('managedBy')
                .populate({ path: 'createdBy', select: 'name role' })
                .sort({ createdAt: -1 })
                .lean(),
            pageParams(req)
        );

        // Some rows have managedBy pointing at a User rather than an Employee.
        // The repair used to run a findOne per row inside a map; it is one query
        // for whichever rows on this page need it.
        const needsRepair = employees.filter(e => !e.managedBy || !e.managedBy.ownCode);
        const targetUserIds = needsRepair
            .map(e => e.managedBy || (e.createdBy && e.createdBy.role === 'supervisor' ? e.createdBy._id : null))
            .filter(Boolean);

        const supervisors = targetUserIds.length
            ? await Employee.find({ userId: { $in: targetUserIds } }).select('_id userId ownCode name').lean()
            : [];
        const supervisorByUser = new Map(supervisors.map(s => [String(s.userId), s]));

        const updatedEmployees = employees.map((empObj) => {
            if (empObj.managedBy && empObj.managedBy.ownCode) return empObj;

            const targetUserId = empObj.managedBy || (empObj.createdBy && empObj.createdBy.role === 'supervisor' ? empObj.createdBy._id : null);
            const supervisor = targetUserId ? supervisorByUser.get(String(targetUserId)) : null;
            if (!supervisor) return empObj;

            return {
                ...empObj,
                managedBy: {
                    _id: supervisor._id,
                    ownCode: supervisor.ownCode,
                    name: supervisor.name
                }
            };
        });

        res.set('X-Total-Count', String(await Employee.countDocuments(query)));
        res.json(updatedEmployees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Add new employee (Supervisor, Field Staff, WFH)
// @route   POST /api/admin/employees
// @access  Private/Admin
async function addEmployee(req, res) {
    try {
        const { name, email, mobile, password, role, supervisorCode, registrationCommission, city, state, address, panCard, aadharCard, panCardPhoto, aadharCardPhoto, allowedCreationScope } = req.body;

        // Validation: Documents and numbers are required
        if (!panCard || !aadharCard || !panCardPhoto || !aadharCardPhoto) {
            return res.status(400).json({ message: 'PAN and Aadhaar numbers and photos are required' });
        }

        // Validation: State, City, and Address are required
        if (!state || !city || !address) {
            return res.status(400).json({ message: 'State, City, and Address are required' });
        }

        // 1. Hierarchy Validation and Restriction based on allowed scope
        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            const scope = supervisorEmp ? supervisorEmp.allowedCreationScope : 'employee_only';
            if (scope === 'all') {
                if (role !== 'employee' && role !== 'supervisor') {
                    return res.status(403).json({ message: 'Supervisors with "All" scope can only create Employees or Supervisors' });
                }
            } else {
                if (role !== 'employee') {
                    return res.status(403).json({ message: 'Supervisors can only create Employees' });
                }
            }
        } else if (req.user.role === 'admin' || req.user.role === 'superadmin') {
            // Admins and Superadmins have full privileges, they can create any role.
            // No restriction needed.
        }

        // 2. Check if user already exists
        const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
        if (userExists) return res.status(400).json({ message: 'User already exists with this email or mobile' });

        // 3. Hierarchy Validation for Field Staff / Employees
        let managedBy = null;
        let supervisorId = null;
        let finalSupervisorCode = supervisorCode;

        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (supervisorEmp) {
                managedBy = supervisorEmp._id;
                finalSupervisorCode = supervisorEmp.ownCode;
            }
            supervisorId = req.user._id;
        } else if (role === 'field_staff' || role === 'employee') {
            if (supervisorCode) {
                const supervisor = await Employee.findOne({ ownCode: supervisorCode, role: 'supervisor' });
                if (supervisor) {
                    managedBy = supervisor._id;
                    supervisorId = supervisor.userId || supervisor._id;
                    finalSupervisorCode = supervisor.ownCode;
                }
            }
        }

        // 4. Generate Unique Code based on role
        const count = await Employee.countDocuments({ role });
        let prefix = 'REMP';
        if (role === 'supervisor') prefix = 'RSUP';
        else if (role === 'field_staff') prefix = 'RSTF';

        const ownCode = `${prefix}${1000 + count + 1}`;

        // 5. Create User Account for Login
        const user = await User.create({
            name,
            email,
            mobile,
            password: password || '123456',
            plainPassword: password || '123456',
            role: role || 'employee',
            city: city || 'Delhi',
            state: state || 'Delhi',
            address: address || '',
            createdBy: req.user._id,
            supervisorId: supervisorId
        });

        // 6. Create Employee Record linked to User
        const employee = await Employee.create({
            name,
            email,
            mobile,
            employeeId: ownCode,
            ownCode,
            userId: user._id,
            role: role || 'employee',
            supervisorCode: finalSupervisorCode,
            managedBy,
            registrationCommission: registrationCommission || 50,
            panCard,
            aadharCard,
            panCardPhoto,
            aadharCardPhoto,
            status: req.user.role === 'supervisor' ? 'pending' : 'verified',
            isActive: req.user.role === 'supervisor' ? false : true,
            allowedCreationScope: role === 'supervisor' ? (allowedCreationScope || 'employee_only') : undefined,
            createdBy: req.user._id,
            state: state || 'Delhi',
            city: city || 'Delhi',
            address: address || ''
        });

        const populated = await Employee.findById(employee._id).populate('userId').populate('managedBy');
        res.status(201).json({
            message: `${role || 'Staff'} created successfully`,
            employee: populated,
            credentials: {
                email,
                password: password || '123456'
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Delete employee
// @route   DELETE /api/admin/employees/:id
// @access  Private/Admin
async function deleteEmployee(req, res) {
    try {
        const employeeId = req.params.id;
        const employee = await Employee.findById(employeeId);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // 1. Delete linked User record if exists
        if (employee.userId) {
            // Extract ObjectId if it was somehow populated
            const uid = employee.userId._id ? employee.userId._id : employee.userId;
            await User.deleteOne({ _id: uid });
        }

        // 2. Delete the Employee record
        await Employee.deleteOne({ _id: employeeId });

        res.json({ success: true, message: 'Employee and user account removed completely' });
    } catch (error) {
        console.error(`[deleteEmployee Error]:`, error);
        res.status(500).json({ message: error.message || "Failed to delete employee" });
    }
}

// @desc    Update employee
// @route   PUT /api/admin/employees/:id
// @access  Private/Admin
async function updateEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const { name, email, mobile, registrationCommission, isActive, panCard, aadharCard, panCardPhoto, aadharCardPhoto, status, state, city, address, password, allowedCreationScope } = req.body;

        employee.name = name || employee.name;
        employee.email = email || employee.email;
        employee.mobile = mobile || employee.mobile;
        employee.registrationCommission = registrationCommission !== undefined ? registrationCommission : employee.registrationCommission;
        employee.isActive = isActive !== undefined ? isActive : employee.isActive;
        employee.panCard = panCard || employee.panCard;
        employee.aadharCard = aadharCard || employee.aadharCard;
        employee.panCardPhoto = panCardPhoto || employee.panCardPhoto;
        employee.aadharCardPhoto = aadharCardPhoto || employee.aadharCardPhoto;
        employee.status = status || employee.status;
        employee.state = state !== undefined ? state : employee.state;
        employee.city = city !== undefined ? city : employee.city;
        employee.address = address !== undefined ? address : employee.address;
        if (allowedCreationScope !== undefined) {
            employee.allowedCreationScope = allowedCreationScope;
        }

        const updated = await employee.save();

        // Also update linked User account
        if (employee.userId) {
            const user = await User.findById(employee.userId);
            if (user) {
                user.name = name || user.name;
                user.email = email || user.email;
                user.mobile = mobile || user.mobile;
                user.state = state !== undefined ? state : user.state;
                user.city = city !== undefined ? city : user.city;
                user.address = address !== undefined ? address : user.address;
                if (password && password !== "********") {
                    user.password = password;
                    user.plainPassword = password;
                }
                await user.save();
            }
        }
        const populated = await Employee.findById(updated._id).populate('userId').populate('managedBy');
        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Verify employee
// @route   PUT /api/admin/employees/:id/verify
// @access  Private/Admin
async function verifyEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        employee.status = 'verified';
        employee.isActive = true; // Ensure they are active when verified

        await employee.save();

        // Log Action
        await AuditLog.create({
            actionType: "VERIFY",
            entityType: "EMPLOYEE",
            entityId: employee._id,
            entityName: employee.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'verified' }
        });

        res.json({ success: true, message: 'Employee verified successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Reject employee
// @route   PUT /api/admin/employees/:id/reject
// @access  Private/Admin
async function rejectEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        employee.status = 'rejected';

        await employee.save();

        // Log Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "EMPLOYEE",
            entityId: employee._id,
            entityName: employee.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected' }
        });

        res.json({ success: true, message: 'Employee verification rejected' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const deleteEmergencyAlert = async (req, res) => {
    try {
        const EmergencyAlert = require('../models/EmergencyAlert');
        await EmergencyAlert.findByIdAndDelete(req.params.id);
        res.json({ message: 'Emergency alert removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ... Super Admin Methods ...

const getAllAdmins = async (req, res) => {
    try {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } })
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(500);
        res.json(admins);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createAdmin = async (req, res) => {
    try {
        const { name, email, mobile, password, permissions, city, state, kycAccess, kycLimit, kycBonusPerVerification } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: 'User already exists with this email' });

        const admin = await User.create({
            name,
            email,
            mobile,
            password,
            role: 'admin',
            permissions: permissions || [],
            city: city || 'Delhi',
            state: state || 'Delhi',
            kycAccess: kycAccess || false,
            kycLimit: kycLimit || 0,
            kycBonusPerVerification: kycBonusPerVerification || 0
        });

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                kycAccess: admin.kycAccess,
                kycLimit: admin.kycLimit,
                kycBonusPerVerification: admin.kycBonusPerVerification
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAdminPermissions = async (req, res) => {
    try {
        const { permissions } = req.body;
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        admin.permissions = permissions;
        await admin.save();

        res.json({ message: 'Permissions updated successfully', permissions: admin.permissions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAdmin = async (req, res) => {
    try {
        const { name, email, mobile, password, permissions, kycAccess, kycLimit, kycBonusPerVerification } = req.body;
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        admin.name = name || admin.name;
        admin.email = email || admin.email;
        admin.mobile = mobile || admin.mobile;
        admin.permissions = permissions || admin.permissions;

        if (kycAccess !== undefined) admin.kycAccess = kycAccess;
        if (kycLimit !== undefined) admin.kycLimit = kycLimit;
        if (kycBonusPerVerification !== undefined) admin.kycBonusPerVerification = kycBonusPerVerification;

        if (password) {
            admin.password = password;
        }

        await admin.save();
        res.json({ message: 'Admin updated successfully', admin });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// The sewak roster renders a link per uploaded document, so unlike the provider
// table it keeps `documents` — but still not the push tokens or service lists.
const SEWAK_LIST_FIELDS = '-password -fcmTokens -fcmTokenMobile -subServices -instaWork.services';

/**
 * A supervisor sees their own team's sewaks and no one else's. That restriction
 * and the screen's own search both want to be `$or` clauses, so they are
 * combined with `$and` — merging them into one `$or` would widen the first by
 * the second, and a supervisor who typed in the search box would see everyone.
 */
const sewakScope = async (req) => {
    const scope = adminProviderScope(req.query, { includeSearch: true });
    const query = { ...scope, providerCategory: 'sewak' };

    if (req.user.role === 'supervisor') {
        const team = await teamCodesFor(req.user._id);
        if (!team) return null;

        const clauses = [{ $or: sewaksOfTeam(team.codes).$or }];
        if (query.$or) {
            clauses.push({ $or: query.$or });
            delete query.$or;
        }
        query.$and = (query.$and || []).concat(clauses);
    }

    return query;
};

const getAllSewaks = async (req, res) => {
    try {
        // No team means nothing to see, not everything.
        const query = await sewakScope(req);
        if (!query) return res.json([]);

        // Handed over one page at a time: a roster of field staff only grows.
        const sewaks = await paginate(
            Provider.find(query)
                .select(SEWAK_LIST_FIELDS)
                .sort({ createdAt: -1 }),
            pageParams(req)
        );

        res.set('X-Total-Count', String(await Provider.countDocuments(query)));
        res.json(sewaks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Counts behind the sewak roster, and the business types to filter by
// @route   GET /api/admin/sewaks/stats
// @access  Private/Admin
const getSewakStats = async (req, res) => {
    try {
        // Not narrowed by the business-type tab: each tab shows its own count.
        const scoped = await sewakScope({ ...req, query: { ...req.query, businessType: undefined, search: undefined } });
        if (!scoped) return res.json({ total: 0, internal: 0, specialized: 0, verified: 0, businessTypes: [] });

        const [row, businessTypes] = await Promise.all([
            Provider.aggregate([
                { $match: scoped },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        internal: { $sum: { $cond: [{ $eq: ['$businessType', 'Internal Service'] }, 1, 0] } },
                        specialized: { $sum: { $cond: [{ $ne: ['$businessType', 'Internal Service'] }, 1, 0] } },
                        verified: { $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] } }
                    }
                }
            ]),
            Provider.distinct('businessType', scoped)
        ]);

        // Each tab carries its own count, which the page of rows cannot supply.
        const byType = {};
        await Promise.all(
            businessTypes.filter(Boolean).map(async (t) => {
                byType[t] = await Provider.countDocuments({ ...scoped, businessType: t });
            })
        );

        res.json({
            total: row[0]?.total || 0,
            internal: row[0]?.internal || 0,
            specialized: row[0]?.specialized || 0,
            verified: row[0]?.verified || 0,
            businessTypes: businessTypes.filter(Boolean).sort(),
            byType
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSewakById = async (req, res) => {
    try {
        const sewak = await Provider.findById(req.params.id).select('-password');
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });
        res.json(sewak);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const createSewak = async (req, res) => {
    try {
        const { ownerName, mobile, password, email, address, city, state, businessType, latitude, longitude, bankDetails } = req.body;

        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
        }

        if (bankDetails && bankDetails.ifscCode) {
            try {
                const response = await axios.get(`https://ifsc.razorpay.com/${bankDetails.ifscCode}`);
                if (!response.data || !response.data.BANK) {
                    return res.status(400).json({ message: 'Invalid IFSC Code' });
                }
                bankDetails.bankName = response.data.BANK;
            } catch (error) {
                return res.status(400).json({ message: 'Invalid IFSC Code or unable to verify' });
            }
        }

        const providerExists = await Provider.findOne({ mobile });
        if (providerExists) {
            return res.status(400).json({ message: 'Mobile number already registered as a provider' });
        }

        // Generate a vendor code for Sewak
        const count = await Provider.countDocuments();
        const vendorCode = `RSSEW${String(count + 1).padStart(5, '0')}`;

        // Find Category to set vendorType
        const category = await Category.findOne({ name: businessType });

        // Resolve who is creating this Sewak
        // If a supervisor is creating, stamp their employee code so the Sewak appears in their panel
        let onboardedByStaff = null;
        if (req.user && (req.user.role === 'supervisor' || req.user.role === 'admin')) {
            const creatorEmployee = await Employee.findOne({ userId: req.user._id });
            if (creatorEmployee && creatorEmployee.ownCode) {
                onboardedByStaff = creatorEmployee.ownCode;
            }
        }

        const sewak = await Provider.create({
            ownerName,
            shopName: `${ownerName} (Sewak)`,
            mobile,
            password,
            email,
            address,
            city,
            state,
            bankDetails: bankDetails || {},
            location: {
                type: 'Point',
                coordinates: [Number(longitude) || 0, Number(latitude) || 0]
            },
            businessType: businessType || 'Internal Service',
            vendorType: category?._id || null,
            vendorCode,
            status: 'pending', // Verification REQUIRED
            providerCategory: 'sewak',
            kycVerified: false,
            commissionRate: 100, // 100% to Admin
            isOnline: false, // Wait until verified
            documents: [], // Documents will be uploaded by Sewak
            onboardedByStaff: onboardedByStaff // Track who registered this Sewak
        });

        // Auto-assign category services to the new Sewak
        if (category && category.services && category.services.length > 0) {
            try {
                const masterServicesData = category.services.map(svc => ({
                    providerId: sewak._id,
                    name: svc.name,
                    description: svc.description,
                    category: category.name,
                    price: svc.basePrice || 299,
                    visible: true
                }));
                const createdServices = await Service.insertMany(masterServicesData);

                // Auto-assign combos
                if (category.combos && category.combos.length > 0) {
                    const comboDocs = category.combos.map(combo => {
                        // Find service IDs for this combo based on names
                        const serviceIds = createdServices
                            .filter(s => combo.services.includes(s.name))
                            .map(s => s._id);

                        return {
                            providerId: sewak._id,
                            name: combo.name,
                            description: combo.description,
                            services: serviceIds,
                            price: combo.sewakPrice || 0,
                            image: combo.image,
                            isActive: true
                        };
                    });
                    await Combo.insertMany(comboDocs);
                }
            } catch (serviceError) {
                console.error("Failed to auto-assign services/combos to Sewak:", serviceError);
            }
        }

        res.status(201).json(sewak);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSewak = async (req, res) => {
    try {
        const { ownerName, mobile, password, email, address, city, state, businessType, bankDetails } = req.body;

        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        if (mobile && mobile !== sewak.mobile) {
            if (!/^\d{10}$/.test(mobile)) {
                return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
            }
            const providerExists = await Provider.findOne({ mobile });
            if (providerExists) return res.status(400).json({ message: 'Mobile number already registered as a provider' });
            sewak.mobile = mobile;
        }

        if (ownerName) {
            sewak.ownerName = ownerName;
            sewak.shopName = `${ownerName} (Sewak)`;
        }
        if (email) sewak.email = email;
        if (address) sewak.address = address;
        if (city) sewak.city = city;
        if (state) sewak.state = state;
        if (businessType) {
            sewak.businessType = businessType;
            const category = await Category.findOne({ name: businessType });
            if (category) sewak.vendorType = category._id;
        }
        if (bankDetails) {
            if (bankDetails.ifscCode) {
                try {
                    const response = await axios.get(`https://ifsc.razorpay.com/${bankDetails.ifscCode}`);
                    if (!response.data || !response.data.BANK) {
                        return res.status(400).json({ message: 'Invalid IFSC Code' });
                    }
                    bankDetails.bankName = response.data.BANK;
                } catch (error) {
                    return res.status(400).json({ message: 'Invalid IFSC Code or unable to verify' });
                }
            }
            sewak.bankDetails = bankDetails;
        }

        // Only update password if provided
        if (password) {
            console.log("Updating password to:", password);
            sewak.password = password;
        }

        console.log("Before save hash:", sewak.password);
        await sewak.save();
        console.log("After save hash:", sewak.password);
        res.json({ message: 'Sewak updated successfully', sewak });
    } catch (error) {
        console.log("Error in updateSewak:", error);
        res.status(500).json({ message: error.message });
    }
};

const verifySuperAdminPin = async (req, res) => {
    try {
        const { pin } = req.body;
        const savedPin = await Setting.findOne({ key: 'SUPER_ADMIN_PIN' });
        const actualPin = savedPin ? savedPin.value : '1234';

        if (pin === actualPin) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid PIN' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSuperAdminPin = async (req, res) => {
    try {
        const { pin } = req.body;
        await Setting.findOneAndUpdate(
            { key: 'SUPER_ADMIN_PIN' },
            { value: pin, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'PIN updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        if (admin.role === 'superadmin') return res.status(400).json({ message: 'Super Admin cannot be deleted' });

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProviderPlan = async (req, res) => {
    try {
        const { planType } = req.body;
        const provider = await Provider.findByIdAndUpdate(
            req.params.id,
            { planType },
            { new: true }
        );
        if (!provider) return res.status(404).json({ message: 'Provider not found' });
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteProvider = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        await Provider.findByIdAndDelete(req.params.id);
        // Clean up services and combos
        await Service.deleteMany({ providerId: req.params.id });
        await Combo.deleteMany({ providerId: req.params.id });

        res.json({ message: 'Provider and associated data removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPendingSewaks = async (req, res) => {
    try {
        let query = {
            providerCategory: 'sewak',
            kycVerified: false,
            $or: [
                { kycSubmitted: true },
                { status: 'pending', kycStatus: { $in: ['draft', 'submitted', 'under_review', 'partially_approved'] } }
            ]
        };

        if (req.user.role === 'supervisor') {
            const team = await teamCodesFor(req.user._id);
            // No employee record means no team, which means nothing to see.
            if (!team) return res.json([]);

            // `$and`, not a merged `$or`: this query already has one, and
            // folding the team restriction into it would widen it instead of
            // narrowing it.
            query = {
                ...query,
                $and: [{ $or: sewaksOfTeam(team.codes).$or }]
            };
        }

        // A KYC queue is worked through, not read in one go.
        const sewaks = await paginate(
            Provider.find(query)
                .select(SEWAK_LIST_FIELDS)
                .sort({ updatedAt: -1 }),
            pageParams(req)
        );

        res.set('X-Total-Count', String(await Provider.countDocuments(query)));
        res.json(sewaks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Should this provider be held back from go-live until the Training Panel is done?
 *
 * Deliberately narrow — it returns `blocked: false` for anything that isn't a
 * Sewak with an incomplete training record, so Partners and already-trained
 * Sewaks provably keep their existing behaviour. Also ensures the record exists,
 * so KYC approval populates the admin's "awaiting training" work queue (D7).
 */
const requiresTrainingBeforeGoLive = async (provider) => {
    try {
        if (provider.providerCategory !== 'sewak') return { blocked: false, reason: 'not_a_sewak' };

        const TrainingRecord = require('../models/TrainingRecord');
        let record = await TrainingRecord.findOne({ sewakId: provider._id });

        if (record && record.trainingCompleted) return { blocked: false, reason: 'training_done' };

        if (!record) {
            const { ensureRecord } = require('./trainingPanelController');
            record = await ensureRecord(provider);
        }
        return { blocked: true, reason: 'training_pending', recordId: record?._id };
    } catch (err) {
        // Never let a training-gate failure break KYC approval; fail open to the
        // previous behaviour rather than stranding the Sewak.
        console.error('[TrainingGate] check failed, allowing go-live:', err.message);
        return { blocked: false, reason: 'gate_error' };
    }
};

const verifySewak = async (req, res) => {
    try {
        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        sewak.kycVerified = true;
        sewak.kycStatus = 'verified';

        // Go-live is owned by the Training Panel, not KYC — a Sewak only becomes
        // discoverable once mandatory kit items are verified and basic training is
        // done. Partners and Sewaks with an already-complete record are unaffected.
        // See TRAINING_PANEL_PLAN.md D2.
        const trainingGate = await requiresTrainingBeforeGoLive(sewak);
        if (trainingGate.blocked) {
            sewak.status = 'pending';
            sewak.isOnline = false;
        } else {
            sewak.status = 'verified';
            sewak.isOnline = true;
        }

        // Verify all documents
        if (sewak.documents) {
            sewak.documents.forEach(doc => {
                doc.status = 'verified';
                doc.reviewedAt = new Date();
            });
        }

        await sewak.save();

        // Notify Provider
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(sewak._id, 'provider', {
                title: 'KYC Approved',
                body: 'Your identity verification is complete. Next step: visit your training centre to verify your starter kit items and complete basic training — your profile goes live right after.',
                data: { type: 'kyc', id: sewak._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on verifySewak:', err.message);
        }

        // Calculate Bonus if applicable
        let bonusEarned = 0;
        if (req.user && req.user.kycAccess) {
            const totalKYCs = await AuditLog.countDocuments({
                verifiedBy: req.user._id,
                actionType: "VERIFY",
                entityType: "SEWAK"
            });

            if (totalKYCs >= req.user.kycLimit) {
                bonusEarned = req.user.kycBonusPerVerification;
            }
        }

        // Log Verification Action
        await AuditLog.create({
            actionType: "VERIFY",
            entityType: "SEWAK",
            entityId: sewak._id,
            entityName: sewak.ownerName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            bonusEarned: bonusEarned,
            details: { status: 'verified', bonusEarned }
        });

        res.json({ success: true, message: 'Sewak verified successfully', isLive: sewak.status === 'verified' && sewak.isOnline });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const rejectSewak = async (req, res) => {
    try {
        const { rejectionReason = 'KYC documents invalid' } = req.body;
        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        sewak.kycVerified = false;
        sewak.kycStatus = 'rejected';
        sewak.status = 'rejected';
        sewak.kycSubmitted = false;
        // Reject all documents
        if (sewak.documents) {
            sewak.documents.forEach(doc => {
                if (doc.status !== 'verified') {
                    doc.status = 'rejected';
                    doc.rejectionReason = rejectionReason;
                    doc.reviewedAt = new Date();
                }
            });
            sewak.markModified('documents');
        }

        await sewak.save();

        // Notify Provider
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(sewak._id, 'provider', {
                title: 'KYC Rejected',
                body: `Your KYC application was rejected. Reason: ${rejectionReason}`,
                data: { type: 'kyc', id: sewak._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on rejectSewak:', err.message);
        }

        // Log Rejection Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "SEWAK",
            entityId: sewak._id,
            entityName: sewak.ownerName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected', rejectionReason }
        });

        res.json({ success: true, message: 'Sewak KYC rejected' });
    } catch (error) {
        console.error("Error in rejectSewak: ", error);
        res.status(500).json({ message: error.message });
    }
};

const verifySewakDocument = async (req, res) => {
    try {
        const { id, docId } = req.params;
        const { status, rejectionReason, adminNotes } = req.body;

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status. Must be verified or rejected.' });
        }

        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({ message: 'Rejection reason is required.' });
        }

        const sewak = await Provider.findById(id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        let docIndex = sewak.documents.findIndex(d => d.id === docId);

        if (docIndex === -1) {
            // Document doesn't exist yet (admin-created sewak with no uploads)
            // Create a placeholder entry with the given status so rejection is recorded
            sewak.documents.push({
                id: docId,
                status,
                reviewedAt: new Date(),
                rejectionReason: status === 'rejected' ? rejectionReason : null,
                adminNotes: adminNotes || null,
            });
        } else {
            // Update existing document fields
            sewak.documents[docIndex].status = status;
            sewak.documents[docIndex].reviewedAt = new Date();
            if (status === 'rejected') {
                sewak.documents[docIndex].rejectionReason = rejectionReason;
            } else {
                sewak.documents[docIndex].rejectionReason = null;
            }
            if (adminNotes !== undefined) {
                sewak.documents[docIndex].adminNotes = adminNotes;
            }
        }

        // Mark modified so mongoose saves nested updates
        sewak.markModified('documents');

        const { sendNotificationToUser } = require('../config/notificationService');

        // Notify the Sewak about individual document status
        try {
            let title = '';
            let body = '';

            if (docId === 'live_video') {
                title = status === 'verified' ? 'Live Video Approved' : 'Live Video Rejected';
                body = status === 'verified'
                    ? 'Your Live Video verification has been approved.'
                    : `Your Live Video verification was rejected. Reason: ${rejectionReason}`;
            } else {
                const docLabel = docId.toUpperCase().replace('_', ' ');
                title = status === 'verified' ? `${docLabel} Approved` : `${docLabel} Rejected`;
                body = status === 'verified'
                    ? `Your ${docLabel} has been approved by the admin.`
                    : `Your ${docLabel} was rejected. Reason: ${rejectionReason}`;
            }

            await sendNotificationToUser(sewak._id, 'provider', {
                title,
                body,
                data: { type: 'kyc', id: sewak._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on doc update:', err.message);
        }

        if (status === 'rejected') {
            sewak.kycStatus = 'rejected';
            sewak.status = 'rejected';
            sewak.kycVerified = false;
            sewak.kycSubmitted = false;

            // Notify Sewak: Overall KYC rejected
            try {
                await sendNotificationToUser(sewak._id, 'provider', {
                    title: 'KYC Rejected',
                    body: `Your KYC application was rejected. Please review and update the rejected items.`,
                    data: { type: 'kyc', id: sewak._id.toString() }
                });
            } catch (err) {
                console.error('Failed to notify provider on overall kyc reject:', err.message);
            }
        } else {
            // Check if ALL required documents and live video are approved
            const requiredDocs = ['aadhaar', 'pan', 'live_video'];
            const allApproved = requiredDocs.every(reqId => {
                const doc = sewak.documents.find(d => d.id === reqId);
                return doc && doc.status === 'verified';
            });

            if (allApproved) {
                sewak.kycStatus = 'verified';
                sewak.kycVerified = true;

                // Go-live is owned by the Training Panel — see D2.
                const docGate = await requiresTrainingBeforeGoLive(sewak);
                if (docGate.blocked) {
                    sewak.status = 'pending';
                    sewak.isOnline = false;
                } else {
                    sewak.status = 'verified';
                    sewak.isOnline = true;
                }

                // Notify Sewak: Overall KYC approved
                try {
                    await sendNotificationToUser(sewak._id, 'provider', {
                        title: 'KYC Approved',
                        body: 'Your identity verification is complete. Next step: visit your training centre to verify your starter kit items and complete basic training — your profile goes live right after.',
                        data: { type: 'kyc', id: sewak._id.toString() }
                    });
                } catch (err) {
                    console.error('Failed to notify provider on overall kyc verify:', err.message);
                }
            } else {
                sewak.kycStatus = 'partially_approved';
            }
        }

        await sewak.save();

        // Audit Logging
        try {
            await AuditLog.create({
                actionType: status === 'verified' ? "APPROVE_DOCUMENT" : "REJECT_DOCUMENT",
                entityType: "SEWAK",
                entityId: sewak._id,
                entityName: sewak.ownerName,
                verifiedBy: req.user._id,
                verifiedByName: req.user.name,
                verifiedByRole: req.user.role,
                details: { docId, status }
            });
        } catch (auditErr) {
            console.error('Audit log failed:', auditErr.message);
        }

        res.json({
            success: true,
            message: `Document ${docId} status updated to ${status}`,
            kycStatus: sewak.kycStatus,
            providerStatus: sewak.status
        });

    } catch (error) {
        console.error('Verify Sewak Document Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Document-wise KYC review for the Providers screen — Partners and Sewaks
 * alike, since `Provider.documents` carries whichever documents were actually
 * collected regardless of category.
 *
 * The whole-provider Approve button already does a blanket verify of every
 * pending document in one click; this is the other path, for looking at one
 * document at a time and rejecting only the one that is wrong, with a reason
 * the provider actually sees — the per-document `status`/`rejectionReason`
 * fields the model has carried all along, with nothing that ever set them.
 *
 * A rejection reason is required, not optional: a rejection with no reason is
 * exactly the kind of thing this was written to stop.
 */
const verifyProviderDocument = async (req, res) => {
    try {
        const { id, docId } = req.params;
        const { status, rejectionReason, adminNotes } = req.body;

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status. Must be verified or rejected.' });
        }
        if (status === 'rejected' && !String(rejectionReason || '').trim()) {
            return res.status(400).json({ message: 'A rejection reason is required.' });
        }

        const provider = await Provider.findById(id);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        const docIndex = provider.documents.findIndex(d => d.id === docId);
        if (docIndex === -1) {
            provider.documents.push({
                id: docId,
                status,
                reviewedAt: new Date(),
                rejectionReason: status === 'rejected' ? rejectionReason.trim() : null,
                adminNotes: adminNotes || null
            });
        } else {
            provider.documents[docIndex].status = status;
            provider.documents[docIndex].reviewedAt = new Date();
            provider.documents[docIndex].rejectionReason = status === 'rejected' ? rejectionReason.trim() : null;
            if (adminNotes !== undefined) provider.documents[docIndex].adminNotes = adminNotes;
        }
        provider.markModified('documents');

        const docLabel = docId.toUpperCase().replace(/_/g, ' ');
        const { sendNotificationToUser } = require('../config/notificationService');
        try {
            await sendNotificationToUser(provider._id, 'provider', {
                title: status === 'verified' ? `${docLabel} Approved` : `${docLabel} Rejected`,
                body: status === 'verified'
                    ? `Your ${docLabel} has been approved by the admin.`
                    : `Your ${docLabel} was rejected. Reason: ${rejectionReason}`,
                data: { type: 'kyc', id: provider._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on document update:', err.message);
        }

        if (status === 'rejected') {
            provider.status = 'rejected';
            provider.kycStatus = 'rejected';
            provider.kycVerified = false;
            provider.kycSubmitted = false;
            try {
                await sendNotificationToUser(provider._id, 'provider', {
                    title: 'KYC Rejected',
                    body: `Your KYC application was rejected. Please review and update the rejected items.`,
                    data: { type: 'kyc', id: provider._id.toString() }
                });
            } catch (err) {
                console.error('Failed to notify provider on overall kyc reject:', err.message);
            }
        } else {
            // Complete once every document actually on file is verified — the
            // documents a Partner and a Sewak collect differ, so this checks
            // what was really submitted rather than a fixed list of ids.
            const allVerified = provider.documents.length > 0
                && provider.documents.every(d => d.status === 'verified');

            if (allVerified) {
                provider.kycVerified = true;
                provider.kycStatus = 'verified';

                // Sewaks stop here until the Training Panel clears them; a
                // Partner has no such gate and this already no-ops for one.
                const docGate = await requiresTrainingBeforeGoLive(provider);
                if (docGate.blocked) {
                    provider.status = 'pending';
                    provider.isOnline = false;
                } else {
                    provider.status = 'verified';
                    provider.isOnline = true;
                }

                try {
                    await sendNotificationToUser(provider._id, 'provider', {
                        title: 'KYC Approved',
                        body: docGate.blocked
                            ? 'Your identity verification is complete. Next step: visit your training centre to verify your starter kit items and complete basic training — your profile goes live right after.'
                            : 'Your identity verification is complete and your profile is now live.',
                        data: { type: 'kyc', id: provider._id.toString() }
                    });
                } catch (err) {
                    console.error('Failed to notify provider on overall kyc verify:', err.message);
                }
            } else {
                provider.kycStatus = 'partially_approved';
            }
        }

        await provider.save();

        try {
            await AuditLog.create({
                actionType: status === 'verified' ? 'APPROVE_DOCUMENT' : 'REJECT_DOCUMENT',
                entityType: provider.providerCategory === 'sewak' ? 'SEWAK' : 'VENDOR',
                entityId: provider._id,
                entityName: provider.shopName || provider.ownerName,
                verifiedBy: req.user._id,
                verifiedByName: req.user.name,
                verifiedByRole: req.user.role,
                details: { docId, status, rejectionReason: status === 'rejected' ? rejectionReason : undefined }
            });
        } catch (auditErr) {
            console.error('Audit log failed:', auditErr.message);
        }

        // The response replaces the modal's provider state directly, which is
        // exactly the grid that just rendered these documents — the list
        // projection (PROVIDER_LIST_FIELDS) strips `documents`, and sending
        // that back here would make every document card vanish the instant
        // one was reviewed.
        const updated = await Provider.findById(id).select('-password -fcmTokens -fcmTokenMobile').lean();
        res.json({
            success: true,
            message: `Document ${docId} status updated to ${status}`,
            provider: updated
        });
    } catch (error) {
        console.error('Verify Provider Document Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all subscription plans
// @route   GET /api/admin/subscriptions
// @access  Private/Admin
const getAdminSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find().populate('category', 'name');
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create subscription plan
// @route   POST /api/admin/subscriptions
// @access  Private/Admin
const createSubscriptionPlan = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.category === "" || data.category === "undefined") {
            data.category = null;
        }
        const plan = await SubscriptionPlan.create(data);
        res.status(201).json(plan);
    } catch (error) {
        console.error("createSubscriptionPlan error:", error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update subscription plan
// @route   PUT /api/admin/subscriptions/:id
// @access  Private/Admin
const updateSubscriptionPlan = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.category === "" || data.category === "undefined") {
            data.category = null;
        }
        const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, data, { new: true });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json(plan);
    } catch (error) {
        console.error("updateSubscriptionPlan error:", error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete subscription plan
// @route   DELETE /api/admin/subscriptions/:id
// @access  Private/Admin
const deleteSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Audit/Verification Logs
// @route   GET /api/admin/audit-logs
// @access  Private/SuperAdmin
const getAuditLogs = async (req, res) => {
    try {
        const { adminId, entityType, startDate, endDate, search, page = 1, limit = 20 } = req.query;
        let query = {};

        if (adminId) query.verifiedBy = adminId;
        if (entityType) query.entityType = entityType;

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                { entityName: { $regex: search, $options: 'i' } },
                { verifiedByName: { $regex: search, $options: 'i' } }
            ];
        }

        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('verifiedBy', 'name email role');

        const total = await AuditLog.countDocuments(query);

        res.json({
            logs,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Night Charge Settings
// @route   GET /api/admin/night-charge
// @access  Private/Admin
const DEFAULT_NIGHT_CHARGE_CONFIG = {
    enabled: false,
    chargeType: 'percent',
    defaultPercent: 10,
    defaultFlatAmount: 0,
    applyToPartner: true,
    applyToSewak: true,
    startTime: '21:00',
    endTime: '06:00'
};

const getNightChargeSettings = async (req, res) => {
    try {
        const globalSetting = await Setting.findOne({ key: 'night_charge_config' });
        const categories = await Category.find({}, 'name hasNightCharge nightChargePercent nightChargeFlatAmount');

        res.json({
            // Spread over the default so a config saved before chargeType/
            // applyToPartner/applyToSewak existed still comes back complete.
            global: globalSetting ? { ...DEFAULT_NIGHT_CHARGE_CONFIG, ...globalSetting.value } : DEFAULT_NIGHT_CHARGE_CONFIG,
            categories
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Global Night Charge Settings
// @route   POST /api/admin/night-charge/global
// @access  Private/Admin
const updateGlobalNightCharge = async (req, res) => {
    try {
        const {
            enabled, chargeType, defaultPercent, defaultFlatAmount,
            applyToPartner, applyToSewak, startTime, endTime
        } = req.body;

        if (!startTime || !endTime) {
            return res.status(400).json({ message: "Start time and End time are required" });
        }
        if (startTime === endTime) {
            return res.status(400).json({ message: "Start time and End time cannot be the same" });
        }
        if (chargeType && !['percent', 'flat'].includes(chargeType)) {
            return res.status(400).json({ message: "chargeType must be 'percent' or 'flat'" });
        }

        const value = {
            enabled,
            chargeType: chargeType || 'percent',
            defaultPercent: Number(defaultPercent) || 0,
            defaultFlatAmount: Number(defaultFlatAmount) || 0,
            applyToPartner: applyToPartner !== undefined ? !!applyToPartner : true,
            applyToSewak: applyToSewak !== undefined ? !!applyToSewak : true,
            startTime,
            endTime
        };

        let setting = await Setting.findOne({ key: 'night_charge_config' });
        if (setting) {
            setting.value = value;
            setting.updatedAt = Date.now();
            await setting.save();
        } else {
            setting = await Setting.create({ key: 'night_charge_config', value });
        }

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Category Night Charge
// @route   PUT /api/admin/night-charge/category/:id
// @access  Private/Admin
const updateCategoryNightCharge = async (req, res) => {
    try {
        const { hasNightCharge, nightChargePercent, nightChargeFlatAmount } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        category.hasNightCharge = hasNightCharge;
        if (nightChargePercent !== undefined) category.nightChargePercent = nightChargePercent;
        if (nightChargeFlatAmount !== undefined) category.nightChargeFlatAmount = nightChargeFlatAmount;
        await category.save();

        res.json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Apply Global Night Charge to all categories
// @route   POST /api/admin/night-charge/apply-all
// @access  Private/Admin
const applyGlobalNightChargeToAll = async (req, res) => {
    try {
        const globalSetting = await Setting.findOne({ key: 'night_charge_config' });
        if (!globalSetting) {
            return res.status(404).json({ message: 'Global settings not found' });
        }

        const { defaultPercent, defaultFlatAmount, enabled } = globalSetting.value;

        await Category.updateMany({}, {
            hasNightCharge: enabled,
            nightChargePercent: defaultPercent || 0,
            nightChargeFlatAmount: defaultFlatAmount || 0
        });

        res.json({ message: 'Applied to all categories successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Admin KYC Performance (Super Admin)
// @route   GET /api/admin/kyc-performance
// @access  Private/SuperAdmin
const getAdminKycPerformance = async (req, res) => {
    try {
        const performance = await AuditLog.aggregate([
            {
                $match: {
                    actionType: "VERIFY",
                    entityType: { $in: ["SEWAK", "VENDOR"] }
                }
            },
            {
                $group: {
                    _id: "$verifiedBy",
                    totalSewakVerified: {
                        $sum: { $cond: [{ $eq: ["$entityType", "SEWAK"] }, 1, 0] }
                    },
                    totalVendorVerified: {
                        $sum: { $cond: [{ $eq: ["$entityType", "VENDOR"] }, 1, 0] }
                    },
                    totalVerified: { $sum: 1 },
                    totalBonus: { $sum: "$bonusEarned" },
                    adminName: { $first: "$verifiedByName" }
                }
            }
        ]);

        // Merge with Admin details to show limit etc.
        // Joined against the performance rows above; capped like any other read.
        const admins = await User.find({ role: 'admin' }, 'name kycLimit kycBonusPerVerification kycAccess')
            .limit(500)
            .lean();

        const report = admins.map(admin => {
            const perf = performance.find(p => p._id && p._id.toString() === admin._id.toString()) || { totalVerified: 0, totalBonus: 0, totalSewakVerified: 0, totalVendorVerified: 0 };
            return {
                adminId: admin._id,
                name: admin.name,
                kycAccess: admin.kycAccess,
                kycLimit: admin.kycLimit,
                bonusPerKyc: admin.kycBonusPerVerification,
                totalVerified: perf.totalVerified || 0,
                totalSewakVerified: perf.totalSewakVerified || 0,
                totalVendorVerified: perf.totalVendorVerified || 0,
                totalBonus: perf.totalBonus || 0,
                remainingForBonus: Math.max(0, admin.kycLimit - (perf.totalVerified || 0))
            };
        });

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Sewak Incentives Report (Super Admin)
// @route   GET /api/admin/sewak-incentives
// @access  Private/SuperAdmin
const getSewakIncentives = async (req, res) => {
    try {
        const { date, sewakId } = req.query;

        // Get Global Settings
        const settings = await Setting.find({ key: { $in: ['DAILY_BOOKING_THRESHOLD', 'BONUS_PER_EXTRA_BOOKING'] } });
        const threshold = Number(settings.find(s => s.key === 'DAILY_BOOKING_THRESHOLD')?.value || 5);
        const bonusAmount = Number(settings.find(s => s.key === 'BONUS_PER_EXTRA_BOOKING')?.value || 50);

        // Define date range
        const queryDate = date || new Date().toISOString().split('T')[0];
        const startOfDay = new Date(queryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(queryDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch Sewaks
        const sewakQuery = { providerCategory: 'sewak' };
        if (sewakId) sewakQuery._id = sewakId;
        const sewaks = await Provider.find(sewakQuery)
            .select('ownerName mobile shopName')
            .limit(5000)
            .lean();

        const sewakIds = sewaks.map(s => s._id);

        // Three queries for the whole report, not two per sewak. This used to
        // run a countDocuments and a findOne inside a map over every sewak on
        // the platform, so a thousand of them meant two thousand round trips.
        const [dayCounts, incentiveLogs] = await Promise.all([
            Booking.aggregate([
                {
                    $match: {
                        providerId: { $in: sewakIds },
                        status: 'completed',
                        updatedAt: { $gte: startOfDay, $lte: endOfDay }
                    }
                },
                { $group: { _id: '$providerId', n: { $sum: 1 } } }
            ]),
            SewakIncentiveLog.find({ sewakId: { $in: sewakIds }, date: queryDate }).lean()
        ]);

        const countByProvider = new Map(dayCounts.map(r => [String(r._id), r.n]));
        const logBySewak = new Map(incentiveLogs.map(l => [String(l.sewakId), l]));

        const logs = sewaks.map((sewak) => {
            const dailyBookingCount = countByProvider.get(String(sewak._id)) || 0;
            const incentiveLog = logBySewak.get(String(sewak._id));

            return {
                _id: incentiveLog?._id || sewak._id, // Fallback to sewak ID if no log
                sewakId: sewak,
                dailyBookingCount,
                bonusEarned: incentiveLog ? incentiveLog.bonusEarned : 0,
                earned: dailyBookingCount > threshold,
                date: queryDate
            };
        });

        // Sort by count descending
        logs.sort((a, b) => b.dailyBookingCount - a.dailyBookingCount);

        res.json({
            logs,
            config: { threshold, bonusAmount }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Sewak Incentive Settings
// @route   POST /api/admin/sewak-incentive-settings
// @access  Private/SuperAdmin
const updateSewakIncentiveSettings = async (req, res) => {
    try {
        const { threshold, bonusAmount } = req.body;

        await Promise.all([
            Setting.findOneAndUpdate({ key: 'DAILY_BOOKING_THRESHOLD' }, { value: threshold, updatedAt: Date.now() }, { upsert: true }),
            Setting.findOneAndUpdate({ key: 'BONUS_PER_EXTRA_BOOKING' }, { value: bonusAmount, updatedAt: Date.now() }, { upsert: true })
        ]);

        res.json({ message: 'Sewak incentive settings updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all combos for admin
// @route   GET /api/admin/combos
// @access  Private/Admin
const getCombos = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        const combos = await Combo.find(query)
            .populate('providerId', 'shopName ownerName mobile city vendorCode')
            .populate('services')
            .sort({ createdAt: -1 });
        res.json(combos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify/Approve a combo
// @route   PUT /api/admin/combos/:id/verify
// @access  Private/Admin
const verifyCombo = async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.id);
        if (!combo) {
            return res.status(404).json({ message: 'Combo not found' });
        }
        combo.status = 'approved';
        combo.isActive = true; // Make it active on approval
        await combo.save();

        // Log Action
        await AuditLog.create({
            actionType: "VERIFY",
            entityType: "COMBO",
            entityId: combo._id,
            entityName: combo.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'approved' }
        });

        res.json({ success: true, message: 'Combo approved' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject a combo
// @route   PUT /api/admin/combos/:id/reject
// @access  Private/Admin
const rejectCombo = async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.id);
        if (!combo) {
            return res.status(404).json({ message: 'Combo not found' });
        }
        combo.status = 'rejected';
        await combo.save();

        // Log Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "COMBO",
            entityId: combo._id,
            entityName: combo.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected' }
        });

        res.json({ success: true, message: 'Combo rejected' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Cash Limits Config
// @route   GET /api/admin/settings/cash-limits
// @access  Private/Admin
const getCashLimitsConfig = async (req, res) => {
    try {
        let configSetting = await Setting.findOne({ key: 'cash_limits_config' });

        let config = {
            defaultLimit: 1500,
            categoryLimits: [],
            serviceLimits: []
        };

        if (configSetting) {
            config = { ...config, ...configSetting.value };
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Cash Limits Config
// @route   PUT /api/admin/settings/cash-limits
// @access  Private/Admin
const updateCashLimitsConfig = async (req, res) => {
    try {
        const { defaultLimit, categoryLimits, serviceLimits } = req.body;

        const newConfig = {
            defaultLimit: Number(defaultLimit) || 1500,
            categoryLimits: Array.isArray(categoryLimits) ? categoryLimits : [],
            serviceLimits: Array.isArray(serviceLimits) ? serviceLimits : []
        };

        await Setting.findOneAndUpdate(
            { key: 'cash_limits_config' },
            { value: newConfig, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        res.json({ message: 'Cash limits updated successfully', config: newConfig });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Global search across users, providers, sewaks, bookings
// @route   GET /api/admin/search?q=...
// @access  Private/Admin
const adminGlobalSearch = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
        return res.json({ users: [], providers: [], sewaks: [], bookings: [] });
    }

    const regex = { $regex: q.trim(), $options: 'i' };
    try {
        const [users, providers, sewaks, bookings] = await Promise.all([
            User.find({ $or: [{ name: regex }, { email: regex }, { mobile: regex }] })
                .select('name email mobile').limit(5).lean(),

            Provider.find({
                providerCategory: { $ne: 'sewak' },
                $or: [{ shopName: regex }, { ownerName: regex }, { mobile: regex }, { vendorCode: regex }]
            }).select('shopName ownerName mobile vendorCode status').limit(5).lean(),

            Provider.find({
                providerCategory: 'sewak',
                $or: [{ ownerName: regex }, { mobile: regex }, { vendorCode: regex }]
            }).select('ownerName mobile vendorCode kycStatus status').limit(5).lean(),

            Booking.find({ $or: [{ bookingId: regex }, { serviceName: regex }] })
                .select('bookingId serviceName status amount createdAt').limit(5).lean(),
        ]);

        res.json({ users, providers, sewaks, bookings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get admin notifications (recent actions + pending items)
// @route   GET /api/admin/notifications
// @access  Private/Admin
const getAdminNotifications = async (req, res) => {
    try {
        const Lead = require('../models/Lead');
        const Withdrawal = require('../models/Withdrawal');
        const [
            recentLogs,
            pendingKyc,
            pendingSewaks,
            pendingEmployees,
            pendingBookings,
            pendingLeads,
            recentLeads,
            pendingWithdrawals
        ] = await Promise.all([
            AuditLog.find().sort({ timestamp: -1 }).limit(5).lean(),
            Provider.countDocuments({ providerCategory: { $ne: 'sewak' }, kycVerified: false, kycSubmitted: true }),
            Provider.countDocuments({ providerCategory: 'sewak', kycVerified: false, $or: [{ kycSubmitted: true }, { status: 'pending' }] }),
            // employees pending verification – use Provider model employees
            Provider.countDocuments({ providerCategory: { $ne: 'sewak' }, status: 'pending' }),
            Booking.countDocuments({ status: 'pending' }),
            Lead.countDocuments({ status: 'available' }),
            Lead.find({ status: 'available' }).sort({ createdAt: -1 }).limit(3).populate('categoryId', 'name').lean(),
            Withdrawal.countDocuments({ status: 'pending' })
        ]);

        const notifications = [];

        if (pendingKyc > 0) {
            notifications.push({
                id: 'kyc-pending',
                type: 'kyc',
                title: `${pendingKyc} Provider KYC Pending`,
                message: 'Provider KYC applications awaiting review.',
                link: '/admin/kyc',
                time: new Date(),
            });
        }

        if (pendingSewaks > 0) {
            notifications.push({
                id: 'sewak-kyc-pending',
                type: 'kyc',
                title: `${pendingSewaks} Sewak KYC Pending`,
                message: 'Sewak verification applications awaiting review.',
                link: '/admin/verify-sewaks',
                time: new Date(),
            });
        }

        if (pendingBookings > 0) {
            notifications.push({
                id: 'bookings-pending',
                type: 'booking',
                title: `${pendingBookings} Pending Bookings`,
                message: 'Bookings awaiting provider assignment.',
                link: '/admin/bookings',
                time: new Date(),
            });
        }

        if (pendingWithdrawals > 0) {
            notifications.push({
                id: 'withdrawals-pending',
                type: 'withdrawal',
                title: `${pendingWithdrawals} Payout Requests Pending`,
                message: 'Withdrawal requests awaiting admin processing.',
                link: '/admin/withdrawals',
                time: new Date(),
            });
        }

        if (pendingLeads > 0) {
            notifications.push({
                id: 'leads-pending',
                type: 'lead',
                title: `${pendingLeads} Pending Leads`,
                message: 'Customer lead requests active in the system.',
                link: '/admin/leads',
                time: new Date(),
            });
        }

        // Add recent available leads
        recentLeads.forEach(l => {
            const dateStr = l.preferredDate || '';
            const timeStr = l.preferredTime || '';
            const scheduleStr = dateStr ? `${dateStr}${timeStr ? ` at ${timeStr}` : ''}` : 'Anytime';

            const areaStr = l.locationDetail?.area || l.locationDetail?.street || '';
            const cityStr = l.locationDetail?.city || '';
            const locStr = [areaStr, cityStr].filter(Boolean).join(', ') || 'Nearby';

            notifications.push({
                id: `lead-${l._id.toString()}`,
                type: 'lead',
                title: `New Lead: ${l.categoryId?.name || 'Request'}`,
                message: `Scheduled for ${scheduleStr} in ${locStr}. Value: ₹${l.leadPrice || 0}`,
                link: '/admin/leads',
                time: l.createdAt,
            });
        });

        // Add recent audit activity
        recentLogs.forEach(log => {
            notifications.push({
                id: log._id.toString(),
                type: 'activity',
                title: `${log.actionType}: ${log.entityType}`,
                message: `${log.verifiedByName || 'Admin'} performed ${log.actionType} on ${log.entityName || log.entityType}`,
                link: '/admin/audit-logs',
                time: log.timestamp,
            });
        });

        // Sort newest first
        notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

        res.json({ notifications: notifications.slice(0, 15), counts: { pendingKyc, pendingSewaks, pendingBookings, pendingLeads, pendingWithdrawals } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Distance Charge Settings
// @route   GET /api/admin/distance-charge
// @access  Private/Admin
const getDistanceChargeSettings = async (req, res) => {
    try {
        let setting = await Setting.findOne({ key: 'distance_charge_config' });
        if (!setting) {
            // Return default
            return res.json({
                enabled: true,
                baseDistance: 3,
                baseFee: 40,
                extraFeePerKm: 10,
                maximumDistance: null,
                maximumCharge: null,
                rounding: 'nearest',
                calculationMethod: 'haversine',
                fallbackCharge: 40
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Distance Charge Settings
// @route   PUT /api/admin/distance-charge
// @access  Private/Admin
const updateDistanceChargeSettings = async (req, res) => {
    try {
        const {
            enabled,
            baseDistance,
            baseFee,
            extraFeePerKm,
            maximumDistance,
            maximumCharge,
            rounding,
            calculationMethod,
            fallbackCharge
        } = req.body;

        const updatedValue = {
            enabled: enabled !== undefined ? enabled : true,
            baseDistance: Number(baseDistance) || 3,
            baseFee: Number(baseFee) || 40,
            extraFeePerKm: Number(extraFeePerKm) || 10,
            maximumDistance: maximumDistance ? Number(maximumDistance) : null,
            maximumCharge: maximumCharge ? Number(maximumCharge) : null,
            rounding: rounding || 'nearest',
            calculationMethod: calculationMethod || 'haversine',
            fallbackCharge: fallbackCharge !== undefined ? Number(fallbackCharge) : 40,
            categoryOverrides: req.body.categoryOverrides || {}
        };

        const setting = await Setting.findOneAndUpdate(
            { key: 'distance_charge_config' },
            { value: updatedValue, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        // Log Action
        await AuditLog.create({
            actionType: "UPDATE_SETTINGS",
            entityType: "DISTANCE_CHARGE",
            entityId: setting._id,
            entityName: "Distance Charge Configuration",
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'update_distance_charge', newValue: updatedValue }
        });

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Get Service Radius Limits (admin-configurable)
// @route   GET /api/admin/settings/service-radius
// @access  Private/Admin
const getServiceRadiusLimits = async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'provider_service_radius_limits' });
        if (!setting) {
            return res.json({ minimumRadius: 1, maximumRadius: 50 });
        }
        return res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Service Radius Limits
// @route   PUT /api/admin/settings/service-radius
// @access  Private/Admin
const updateServiceRadiusLimits = async (req, res) => {
    try {
        const { minimumRadius, maximumRadius } = req.body;

        const min = Number(minimumRadius);
        const max = Number(maximumRadius);

        if (isNaN(min) || isNaN(max)) {
            return res.status(400).json({ message: 'minimumRadius and maximumRadius must be valid numbers.' });
        }
        if (min <= 0) {
            return res.status(400).json({ message: 'minimumRadius must be greater than 0.' });
        }
        if (max <= min) {
            return res.status(400).json({ message: 'maximumRadius must be greater than minimumRadius.' });
        }

        const updatedValue = { minimumRadius: min, maximumRadius: max };

        const setting = await Setting.findOneAndUpdate(
            { key: 'provider_service_radius_limits' },
            { value: updatedValue, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        // Audit log
        await AuditLog.create({
            actionType: 'UPDATE_SETTINGS',
            entityType: 'SERVICE_RADIUS_LIMITS',
            entityId: setting._id,
            entityName: 'Provider Service Radius Limits',
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'update_service_radius_limits', newValue: updatedValue }
        });

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user wallet and history by admin
// @route   GET /api/admin/users/:id/wallet
// @access  Private/Admin
const getUserWalletByAdmin = async (req, res) => {
    try {
        const { Wallet, Transaction } = require('../models/Wallet');
        const wallet = await Wallet.findOne({ userId: req.params.id });
        const transactions = await Transaction.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(50);

        res.json({
            balance: wallet ? wallet.balance : 0,
            transactions: transactions || []
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ============================================================
// UNAUTHORIZED PAYMENT MONITORING — Admin Functions
// ============================================================

// @desc    Get all bookings with unauthorized payment flags
// @route   GET /api/admin/bookings/unauthorized-payments
// @access  Private/Admin
const getUnauthorizedPayments = async (req, res) => {
    try {
        const { startDate, endDate, providerId, page = 1, limit = 50 } = req.query;
        const query = { unauthorizedPaymentFlag: true };

        if (startDate || endDate) {
            query.unauthorizedPaymentAt = {};
            if (startDate) query.unauthorizedPaymentAt.$gte = new Date(startDate);
            if (endDate) query.unauthorizedPaymentAt.$lte = new Date(endDate);
        }
        if (providerId) query.unauthorizedAttemptedBy = providerId;

        const total = await Booking.countDocuments(query);
        const bookings = await Booking.find(query)
            .sort({ unauthorizedPaymentAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('userId', 'name phone')
            .populate('unauthorizedAttemptedBy', 'ownerName shopName phone');

        res.json({ total, page: Number(page), limit: Number(limit), bookings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Clear unauthorized payment flag after admin investigation
// @route   PATCH /api/admin/bookings/:id/clear-payment-flag
// @access  Private/Admin
const clearUnauthorizedPaymentFlag = async (req, res) => {
    try {
        const PaymentAudit = require('../models/PaymentAudit');
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (!booking.unauthorizedPaymentFlag) {
            return res.status(400).json({ message: 'No unauthorized payment flag is set on this booking.' });
        }

        const { investigationNote } = req.body;

        // Audit the clearance action
        await PaymentAudit.create({
            bookingId: booking._id,
            adminId: req.user._id,
            action: 'flag_cleared',
            amount: booking.totalAmount,
            note: investigationNote || 'Flag cleared by admin after investigation.'
        });

        booking.unauthorizedPaymentFlag = false;
        await booking.save();

        res.json({ message: 'Unauthorized payment flag cleared.', bookingId: booking._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get full payment audit trail for a booking
// @route   GET /api/admin/bookings/:id/payment-audit
// @access  Private/Admin
const getBookingPaymentAudit = async (req, res) => {
    try {
        const PaymentAudit = require('../models/PaymentAudit');
        // One booking's payment trail. Capped: an audit log only grows.
        const audit = await PaymentAudit.find({ bookingId: req.params.id })
            .limit(500)
            .sort({ createdAt: 1 })
            .populate('providerId', 'ownerName shopName')
            .populate('staffId', 'name')
            .populate('adminId', 'name');
        res.json(audit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all coupons for admin
// @route   GET /api/admin/coupons
// @access  Private/Admin
const getAdminCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().populate('targetCategory', 'name').sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new coupon
// @route   POST /api/admin/coupons
// @access  Private/Admin
const createCoupon = async (req, res) => {
    try {
        const { code, discount, description, expiryDate, maxUsage, minOrderAmount, maxDiscountAmount, targetCategory } = req.body;

        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discount,
            description,
            expiryDate,
            maxUsage,
            minOrderAmount,
            maxDiscountAmount,
            targetCategory: targetCategory || null
        });

        await newCoupon.save();
        const savedCoupon = await Coupon.findById(newCoupon._id).populate('targetCategory', 'name');
        res.status(201).json(savedCoupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle coupon status
// @route   PUT /api/admin/coupons/:id/toggle
// @access  Private/Admin
const toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        if (coupon.expiryDate < new Date()) {
            return res.status(400).json({ message: 'Cannot enable an expired coupon' });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();

        const updatedCoupon = await Coupon.findById(coupon._id).populate('targetCategory', 'name');
        res.json(updatedCoupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        await Coupon.deleteOne({ _id: coupon._id });
        res.json({ message: 'Coupon removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProviders,
    getProviderById,
    getProviderStats,
    getProviderPicker,
    getProviderReports,
    resolveProviderReport,
    updateProviderStatus,
    updateProviderPlan,
    getAdminStats,
    getBookings,
    getBookingStats,
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getUsers,
    getUserStats,
    getUserWalletByAdmin,
    toggleUserStatus,
    getBanners,
    addBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    uploadBannerVideo,
    getEmergencyData,
    broadcastEmergency,
    get99CardData,
    getFeedbackData,
    getActivityLogs,
    getLoginLogs,
    getLoginLogCities,
    getSettings,
    updateSettings,
    updateAdminProfile,
    getPromotions,
    createPromotion,
    deletePromotion,
    getZones,
    addZone,
    deleteZone,
    getEmployees,
    getEmployeeStats,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    verifyEmployee,
    rejectEmployee,
    deleteEmergencyAlert,
    getAllAdmins,
    createAdmin,
    updateAdminPermissions,
    verifySuperAdminPin,
    updateSuperAdminPin,
    deleteAdmin,
    updateAdmin,
    getAllSewaks,
    getSewakStats,
    getSewakById,
    createSewak,
    updateSewak,
    getPendingSewaks,
    verifySewak,
    rejectSewak,
    verifySewakDocument,
    verifyProviderDocument,
    deleteProvider,
    getAdminSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    updateProviderCategory,
    getAuditLogs,
    getNightChargeSettings,
    updateGlobalNightCharge,
    updateCategoryNightCharge,
    applyGlobalNightChargeToAll,
    getAdminKycPerformance,
    getSewakIncentives,
    updateSewakIncentiveSettings,
    getCombos,
    verifyCombo,
    rejectCombo,
    getCashLimitsConfig,
    updateCashLimitsConfig,
    deleteUser,
    deleteBooking,
    adminGlobalSearch,
    getAdminNotifications,
    getDistanceChargeSettings,
    updateDistanceChargeSettings,
    getServiceRadiusLimits,
    updateServiceRadiusLimits,
    getUnauthorizedPayments,
    clearUnauthorizedPaymentFlag,
    getBookingPaymentAudit,
    getAdminCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,
};
