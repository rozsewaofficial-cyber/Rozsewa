const cron = require('node-cron');
const InstaJob = require('../models/InstaJob');
const InstaConfig = require('../services/InstaConfigService');

/**
 * Background housekeeping for Insta Work.
 *
 * Nothing is scheduled at import time — the schedules are created only when
 * startInstaCron() is called, so requiring this module from a script or a test
 * never starts mutating jobs.
 *
 * None of this is load-bearing for correctness: extension expiry is also
 * applied lazily wherever extensions are read, and billing is capped at stop
 * time. The cron exists so stale jobs don't sit in the customer's app forever.
 */
let started = false;

/** Closes off extension requests the customer never answered. */
const expirePendingExtensions = async () => {
    const config = await InstaConfig.getConfig();
    const cutoff = new Date(Date.now() - Math.max(1, Number(config.extensionResponseMinutes) || 10) * 60000);

    const jobs = await InstaJob.find({
        status: 'WORK_STARTED',
        'extensions.status': 'pending',
        'extensions.requestedAt': { $lte: cutoff }
    }).limit(500);

    let expired = 0;
    for (const job of jobs) {
        let changed = false;
        for (const ext of job.extensions) {
            if (ext.status === 'pending' && ext.requestedAt <= cutoff) {
                ext.status = 'expired';
                changed = true;
                expired += 1;
            }
        }
        if (changed) {
            job.statusHistory.push({
                status: job.status,
                at: new Date(),
                by: 'system',
                note: 'Extension request expired without a customer response'
            });
            await job.save();
        }
    }
    return expired;
};

/**
 * Cancels jobs that never found a worker.
 *
 * A job sitting in MATCHING or REQUESTED indefinitely is worse than a clear
 * failure: the customer keeps waiting for someone who is never coming.
 */
const cancelUnmatchedJobs = async () => {
    const cutoff = new Date(Date.now() - 15 * 60000);
    const jobs = await InstaJob.find({
        status: { $in: ['REQUESTED', 'MATCHING'] },
        providerId: null,
        createdAt: { $lte: cutoff }
    }).limit(200);

    for (const job of jobs) {
        job.cancelledBy = 'system';
        job.cancellationReason = 'No worker was available';
        job.cancellationFee = 0;
        job.cancellationStage = 'beforeAcceptance';
        job.pushStatus('CANCELLED', 'system', 'Cancelled automatically — no worker found');
        await job.save();

        try {
            const { notifyUser } = require('../config/notificationService');
            await notifyUser({
                userId: job.customerId,
                userRole: 'user',
                title: 'No worker available',
                message: `We could not find anyone for ${job.jobCode}. You have not been charged.`,
                type: 'booking'
            });
        } catch (err) {
            console.log('[InstaWork] unmatched notify failed:', err.message);
        }
    }
    return jobs.length;
};

const sweep = async () => {
    const [expired, cancelled] = await Promise.all([
        expirePendingExtensions(),
        cancelUnmatchedJobs()
    ]);
    if (expired || cancelled) {
        console.log(`[InstaWork] Sweep: ${expired} extension(s) expired, ${cancelled} unmatched job(s) cancelled`);
    }
    return { expired, cancelled };
};

const startInstaCron = () => {
    if (started) return;
    started = true;

    // Every two minutes: an unanswered extension and a job with no worker are
    // both things the customer is actively waiting on.
    cron.schedule('*/2 * * * *', async () => {
        try {
            await sweep();
        } catch (err) {
            console.error('[InstaWork] Sweep failed:', err.message);
        }
    });

    console.log('RozSewa Insta Work cron jobs initialized.');
};

module.exports = { startInstaCron, sweep, expirePendingExtensions, cancelUnmatchedJobs };
