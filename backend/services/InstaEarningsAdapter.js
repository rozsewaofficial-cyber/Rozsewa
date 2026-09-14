const InstaJob = require('../models/InstaJob');

/**
 * Presents finished Insta Work jobs in the shape the earnings analytics already
 * understand, so Insta revenue appears alongside booking revenue.
 *
 * Without this the whole module is invisible in reporting: the admin Earnings
 * dashboard and a worker's own earnings screen both read `Booking`, so every
 * rupee of Insta commission and payout simply never showed up.
 *
 * Adapting rather than duplicating keeps one set of analytics. The alternative —
 * a parallel Insta earnings calculation — is how two sets of numbers that
 * disagree get created.
 */

/** Insta statuses that correspond to a booking's `completed`. */
const DONE_STATUSES = ['PAYMENT_COMPLETED', 'CLOSED'];

/**
 * Maps one job onto the booking fields the analytics read.
 *
 * `paymentMode` is translated because the reports speak Booking's vocabulary:
 * a cash Insta job is the equivalent of a booking paid 'after'.
 */
const toBookingShape = (job) => ({
    _id: job._id,
    createdAt: job.createdAt,
    status: job.status === 'CANCELLED' ? 'cancelled' : 'completed',
    paymentStatus: job.paymentStatus === 'paid' ? 'paid' : 'pending',
    paymentMode: job.paymentMode === 'online' ? 'now' : 'after',

    totalAmount: Number(job.finalAmount) || 0,
    adminCommission: Number(job.adminCommission) || 0,
    providerPayout: Number(job.providerPayout) || 0,

    serviceName: job.serviceName,
    // The commission queue lists a date and time per row and renders them as
    // given — Booking stores them as strings, not Dates. An Insta job has no
    // scheduled slot, so its creation moment is the only honest answer.
    bookingDate: new Date(job.createdAt).toISOString().slice(0, 10),
    bookingTime: new Date(job.createdAt).toTimeString().slice(0, 5),
    commissionStatus: job.commissionStatus || 'free',

    providerId: job.providerId,
    userId: job.customerId,

    // Insta Work has no travel charge of its own; distance-priced jobs bill it
    // through the rate instead.
    travelCharge: { amount: 0, status: 'final' },
    // No coin or offer discounts apply to Insta jobs yet, so the platform funds
    // nothing here. Present so the subsidy readers find their fields.
    coinDiscount: 0,
    offerSubsidy: 0,
    commissionSnapshot: {
        coinSubsidy: 0,
        offerSubsidy: 0,
        platformSubsidy: 0,
        bookingCategorySnapshot: { name: 'Insta Work' },
        platformEarnings: Number(job.adminCommission) || 0,
        netPlatformEarnings: Number(job.adminCommission) || 0
    },

    // Lets a report tell an Insta row apart from an ordinary booking.
    source: 'insta'
});

/** Booking-vocabulary status -> the Insta statuses that mean the same thing. */
const instaStatusesFor = (bookingStatus) => {
    const wanted = bookingStatus && bookingStatus.$in
        ? bookingStatus.$in
        : [bookingStatus || 'completed'];
    const out = [];
    if (wanted.includes('completed')) out.push(...DONE_STATUSES);
    if (wanted.includes('cancelled')) out.push('CANCELLED');
    return out;
};

/**
 * Finished Insta jobs in a window, shaped for the analytics service.
 *
 * The caller's filters arrive in Booking's vocabulary, because that is what the
 * admin dashboard speaks; they are translated here rather than at the call site
 * so the controller does not need to know Insta's status names.
 */
const getJobsForEarnings = async ({ start, end, providerId = null, status = null, category = null }) => {
    const statuses = instaStatusesFor(status);
    // Every requested status maps to nothing on this side — there is simply no
    // Insta equivalent, so there is nothing to add.
    if (!statuses.length) return [];

    const query = {
        createdAt: { $gte: start, $lte: end },
        status: { $in: statuses }
    };
    if (providerId) query.providerId = providerId;
    // 'Insta Work' is the category name the adapter reports for every job, so a
    // filter on it keeps all of them; any other category keeps only matching
    // service names.
    if (category && category !== 'Insta Work') query.serviceName = category;

    // Only the provider fields the reports read — the city filter and the top
    // partners list — rather than the whole provider on every row.
    const jobs = await InstaJob.find(query)
        .populate('providerId', 'shopName ownerName profileImage city')
        .lean();
    return jobs.map(toBookingShape);
};

/**
 * Completed Insta jobs, shaped for earnings. With no providerId this is every
 * worker's — which is what the admin totals need.
 *
 * `since` exists because a caller reporting on a window should read that window
 * rather than a worker's whole history: a dashboard showing this month has no
 * use for jobs from two years ago.
 */
const getProviderJobs = async (providerId = null, { populate = false, since = null, limit = null } = {}) => {
    const query = { status: { $in: DONE_STATUSES } };
    if (providerId) query.providerId = providerId;
    if (since) query.createdAt = { $gte: since };

    let q = InstaJob.find(query);
    if (populate) q = q.populate('providerId', 'shopName ownerName bankDetails planType providerCategory');
    if (limit) q = q.sort({ createdAt: -1 }).limit(limit);
    const jobs = await q.lean();
    return jobs.map(toBookingShape);
};

/** How many finished jobs a worker has, without reading any of them. */
const countProviderJobs = (providerId) =>
    InstaJob.countDocuments({ providerId, status: { $in: DONE_STATUSES } });

module.exports = {
    DONE_STATUSES, toBookingShape, getJobsForEarnings, getProviderJobs, countProviderJobs
};
