const Booking = require('../models/Booking');
const EarningsAnalyticsService = require('./EarningsAnalyticsService');

/**
 * The admin settlement queue, computed in the database rather than in memory.
 *
 * This page used to load every completed booking and every completed Insta job
 * into the Node process — populated — and then reduce over them for four
 * numbers and slice them for one screenful. That is fine with a few hundred
 * rows and fatal with a few hundred thousand.
 *
 * Both collections are merged with $unionWith so the rows are ordered and paged
 * across the two as a single list. Paging each collection separately and
 * stitching the halves together would give a different set of rows per page
 * depending on how the dates happened to interleave.
 */

/** Insta statuses that mean the job is finished, matching InstaEarningsAdapter. */
const INSTA_DONE = ['PAYMENT_COMPLETED', 'CLOSED'];

/**
 * Projects an Insta job onto the fields a booking row carries.
 *
 * The queue speaks Booking's vocabulary because that is what the admin screen
 * reads; cash on site is the equivalent of a booking paid 'after'.
 */
const instaProjection = () => ({
    createdAt: 1,
    serviceName: 1,
    providerId: 1,
    totalAmount: { $ifNull: ['$finalAmount', 0] },
    adminCommission: { $ifNull: ['$adminCommission', 0] },
    providerPayout: { $ifNull: ['$providerPayout', 0] },
    commissionStatus: { $ifNull: ['$commissionStatus', 'free'] },
    paymentStatus: { $ifNull: ['$paymentStatus', 'pending'] },
    paymentMode: {
        $cond: [{ $eq: ['$paymentMode', 'online'] }, 'now', 'after']
    },
    // An Insta job has no scheduled slot, so its creation moment is the only
    // honest answer. Formatted here because the screen renders them as given.
    bookingDate: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
    bookingTime: { $dateToString: { format: '%H:%M', date: '$createdAt' } },
    source: { $literal: 'insta' }
});

/** Projects a booking onto the same fields. */
const bookingProjection = () => ({
    createdAt: 1,
    serviceName: 1,
    providerId: 1,
    // The same gross the settlement engine and the earnings dashboard use: a
    // platform-funded discount does not shrink the job, and without it a row's
    // commission and payout would not add up to its own job value.
    totalAmount: EarningsAnalyticsService.grossAggregationExpr(),
    adminCommission: { $ifNull: ['$adminCommission', 0] },
    providerPayout: 1,
    commissionStatus: { $ifNull: ['$commissionStatus', 'free'] },
    paymentStatus: 1,
    paymentMode: { $ifNull: ['$paymentMode', 'now'] },
    bookingDate: 1,
    bookingTime: 1,
    source: { $literal: 'booking' }
});

/** The merged, normalised set of settled work — bookings and Insta jobs alike. */
const unionStages = () => ([
    { $match: { status: 'completed' } },
    { $project: bookingProjection() },
    {
        $unionWith: {
            coll: 'instajobs',
            pipeline: [
                { $match: { status: { $in: INSTA_DONE } } },
                { $project: instaProjection() }
            ]
        }
    }
]);

/**
 * Legacy rows never had providerPayout written, so it is derived the same way
 * the old in-memory code did rather than reported as zero.
 */
const payoutExpr = () => ({
    $cond: [
        { $ne: [{ $ifNull: ['$providerPayout', null] }, null] },
        '$providerPayout',
        { $subtract: ['$totalAmount', '$adminCommission'] }
    ]
});

/**
 * The headline figures, and the totals under the table.
 *
 * Returned together because the table's totals row describes the whole queue,
 * not the page being viewed — it would otherwise change as the admin paged.
 */
const getTotals = async () => {
    const [row] = await Booking.aggregate([
        ...unionStages(),
        {
            $group: {
                _id: null,
                platformRevenue: { $sum: '$adminCommission' },
                totalJobValue: { $sum: '$totalAmount' },
                totalProviderPayout: { $sum: payoutExpr() },
                totalCompleted: { $sum: 1 }
            }
        }
    ]);

    return {
        platformRevenue: row?.platformRevenue || 0,
        totalJobValue: row?.totalJobValue || 0,
        totalProviderPayout: row?.totalProviderPayout || 0,
        totalCompleted: row?.totalCompleted || 0
    };
};

/** One screenful of the queue, newest first, across both collections. */
const getPage = async ({ page = 1, limit = 25 } = {}) => {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 25), 200);
    const safePage = Math.max(1, Number(page) || 1);

    const rows = await Booking.aggregate([
        ...unionStages(),
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (safePage - 1) * safeLimit },
        { $limit: safeLimit },
        // Only the rows on this page are joined to their provider, rather than
        // populating the whole collection to render one screen.
        {
            $lookup: {
                from: 'providers',
                localField: 'providerId',
                foreignField: '_id',
                as: 'provider',
                pipeline: [{ $project: { shopName: 1, ownerName: 1, planType: 1, providerCategory: 1 } }]
            }
        },
        { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
        { $addFields: { payout: payoutExpr() } }
    ]);

    return rows.map(r => ({
        _id: r._id,
        bookingId: String(r._id).slice(-6).toUpperCase(),
        vendor: r.provider?.shopName || 'N/A',
        vendorOwner: r.provider?.ownerName || '',
        vendorPlan: r.provider?.planType || 'none',
        vendorCategory: r.provider?.providerCategory || 'provider',
        serviceName: r.serviceName,
        bookingDate: r.bookingDate,
        bookingTime: r.bookingTime,
        jobV: r.totalAmount,
        com: r.adminCommission,
        comRate: r.totalAmount > 0 ? ((r.adminCommission / r.totalAmount) * 100).toFixed(1) : '0',
        pay: r.payout,
        commissionStatus: r.commissionStatus,
        paymentMode: r.paymentMode,
        paymentStatus: r.paymentStatus,
        status: r.paymentStatus === 'paid' ? 'Processed' : 'Ready to Pay',
        createdAt: r.createdAt,
        source: r.source
    }));
};

module.exports = { INSTA_DONE, getTotals, getPage };
