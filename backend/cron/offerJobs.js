const cron = require('node-cron');
const ServiceOffer = require('../models/ServiceOffer');

/**
 * Keeps the denormalised ServiceOffer.status label in step with the clock, so
 * the admin table can filter and sort on it cheaply.
 *
 * This job is a convenience, NOT the enforcement mechanism. Customer-facing
 * reads and booking-time price resolution filter on the date window directly
 * (OfferService.liveFilter), so a missed run here can never leave an expired
 * offer bookable — it would only make the admin list's badge stale.
 *
 * Nothing is scheduled at import time: the schedules are created only when
 * startOfferCron() is called, so requiring this module from a script or a test
 * never starts mutating rows.
 */
let started = false;

const syncOfferStatuses = async () => {
    const now = new Date();

    const [expired, activated, scheduled] = await Promise.all([
        // Window has closed.
        ServiceOffer.updateMany(
            { isActive: true, endDate: { $lt: now }, status: { $ne: 'expired' } },
            { $set: { status: 'expired' } }
        ),
        // Window has opened.
        ServiceOffer.updateMany(
            {
                isActive: true,
                startDate: { $lte: now },
                endDate: { $gte: now },
                status: { $ne: 'active' }
            },
            { $set: { status: 'active' } }
        ),
        // Switched on but not started yet.
        ServiceOffer.updateMany(
            { isActive: true, startDate: { $gt: now }, status: { $ne: 'scheduled' } },
            { $set: { status: 'scheduled' } }
        )
    ]);

    // An admin-disabled offer reads 'inactive' regardless of its dates.
    const deactivated = await ServiceOffer.updateMany(
        { isActive: false, status: { $ne: 'inactive' } },
        { $set: { status: 'inactive' } }
    );

    const summary = {
        expired: expired.modifiedCount || 0,
        activated: activated.modifiedCount || 0,
        scheduled: scheduled.modifiedCount || 0,
        deactivated: deactivated.modifiedCount || 0
    };

    const touched = Object.values(summary).reduce((a, b) => a + b, 0);
    if (touched > 0) console.log('[Offers] Status sweep:', summary);
    return summary;
};

const startOfferCron = () => {
    if (started) return;
    started = true;

    // Every 15 minutes, so an offer whose window opens or closes mid-day is
    // reflected in the admin list promptly without hammering the collection.
    cron.schedule('*/15 * * * *', async () => {
        try {
            await syncOfferStatuses();
        } catch (err) {
            console.error('[Offers] Status sweep failed:', err.message);
        }
    });

    console.log('RozSewa Offer cron jobs initialized.');
};

module.exports = { startOfferCron, syncOfferStatuses };
