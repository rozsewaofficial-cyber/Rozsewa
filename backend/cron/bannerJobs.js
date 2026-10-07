const cron = require('node-cron');
const ProviderBanner = require('../models/ProviderBanner');
const Banners = require('../services/BannerService');

const DAY = 24 * 60 * 60 * 1000;

/**
 * One pass of banner housekeeping. Each banner is handled on its own, so one
 * failure (a deleted provider, a push error) never stops the rest — the old
 * job built its notification with the wrong fields, threw on the first
 * expired banner and skipped every expiry notice and reminder after it.
 */
const runBannerHousekeeping = async (now = new Date()) => {
    const summary = { activated: 0, expired: 0, reminded: 0, failed: 0 };

    // 1. Rows approved under the old flow (status 'Approved') go live once
    //    their start date arrives. New approvals are Active immediately.
    const activated = await ProviderBanner.updateMany(
        { status: 'Approved', startDate: { $lte: now }, endDate: { $gte: now } },
        { $set: { status: Banners.STATUS.ACTIVE } }
    );
    summary.activated = activated.modifiedCount || 0;

    // 2. Expire banners whose end has passed, telling each partner once.
    const ending = await ProviderBanner.find({ status: { $in: [Banners.STATUS.ACTIVE, 'Approved'] }, endDate: { $lt: now } })
        .select('_id provider planType')
        .lean();
    for (const b of ending) {
        try {
            const res = await ProviderBanner.updateOne(
                { _id: b._id, status: { $in: [Banners.STATUS.ACTIVE, 'Approved'] } },
                { $set: { status: Banners.STATUS.EXPIRED } }
            );
            if (res.modifiedCount) {
                summary.expired += 1;
                await Banners.notifyProvider(b.provider, 'Banner Expired',
                    `Your ${b.planType} promotion banner has expired. Renew it now to maintain your visibility!`);
            }
        } catch (err) {
            summary.failed += 1;
            console.error('[CRON] Banner expiry failed for', String(b._id), err.message);
        }
    }

    // 3. One reminder per banner, when it has 3 days or less to run.
    const soon = await ProviderBanner.find({
        status: Banners.STATUS.ACTIVE,
        endDate: { $gte: now, $lte: new Date(now.getTime() + 3 * DAY) },
        reminderSentAt: null
    }).select('_id provider planType endDate').lean();
    for (const b of soon) {
        try {
            const res = await ProviderBanner.updateOne({ _id: b._id, reminderSentAt: null }, { $set: { reminderSentAt: now } });
            if (res.modifiedCount) {
                summary.reminded += 1;
                const ends = new Date(b.endDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                await Banners.notifyProvider(b.provider, 'Banner Expiring Soon',
                    `Your ${b.planType} promotion banner ends on ${ends}. Renew it to keep getting more orders!`);
            }
        } catch (err) {
            summary.failed += 1;
            console.error('[CRON] Banner reminder failed for', String(b._id), err.message);
        }
    }

    return summary;
};

const startBannerCronJobs = () => {
    // Every hour, on Indian time, so a banner ends close to when it was due
    // and reminders do not depend on the server's own timezone.
    cron.schedule('5 * * * *', async () => {
        try {
            const s = await runBannerHousekeeping();
            if (s.activated || s.expired || s.reminded || s.failed) console.log('[CRON] Banners:', JSON.stringify(s));
        } catch (error) {
            console.error('[CRON] Error in banner status check:', error);
        }
    }, { timezone: 'Asia/Kolkata' });
};

module.exports = startBannerCronJobs;
module.exports.runBannerHousekeeping = runBannerHousekeeping;
