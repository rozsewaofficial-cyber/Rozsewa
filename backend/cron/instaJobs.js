const cron = require('node-cron');
const InstaJob = require('../models/InstaJob');
const InstaConfig = require('../services/InstaConfigService');
const Settlement = require('../services/InstaSettlementService');

const notify = (userId, userRole, title, message) => {
    if (!userId) return;
    try {
        const { notifyUser } = require('../config/notificationService');
        notifyUser({ userId, userRole, title, message, type: 'booking' })
            .catch(err => console.log('[InstaWork] notify failed:', err.message));
    } catch (err) {
        console.log('[InstaWork] notify threw:', err.message);
    }
};

const emitJob = (job, event, payload = {}) => {
    try {
        const { emitToUser, emitToProvider } = require('../config/socket');
        const body = { jobId: String(job._id), jobCode: job.jobCode, status: job.status, ...payload };
        emitToUser(job.customerId, event, body);
        if (job.providerId) emitToProvider(job.providerId, event, body);
    } catch (err) {
        console.log('[InstaWork] socket emit failed:', err.message);
    }
};

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

/**
 * Confirms finished work the customer never got round to confirming.
 *
 * Only the customer could move a job out of WORK_COMPLETED, so one who closed
 * the app left the job there for good: the worker was never paid, and after
 * the worker's own cancel was correctly closed off there was no way out at all.
 *
 * What happens next depends on how the job was being paid, because the two are
 * not the same situation:
 *
 *   cash   — the money changed hands at the customer's door when the work
 *            ended. The tap in the app is bookkeeping about something that has
 *            already happened, so the job is completed and settled, and the
 *            worker's commission is finally recorded.
 *   online — nothing has been paid. A timer cannot charge a card nobody
 *            authorised, so the job moves on to await payment and the customer
 *            is told the bill is due. That turns a job stuck forever into an
 *            ordinary unpaid bill, which is a collections problem rather than
 *            a dead end.
 *
 * A job that came to nothing is closed either way — there is no bill to chase.
 */
const autoConfirmAbandonedJobs = async () => {
    const config = await InstaConfig.getConfig();
    const hours = Number(config.autoConfirmHours) || 0;
    if (hours <= 0) return 0;

    const cutoff = new Date(Date.now() - hours * 3600000);
    const jobs = await InstaJob.find({
        status: 'WORK_COMPLETED',
        workCompletedAt: { $lte: cutoff }
    }).limit(200);

    let confirmed = 0;
    for (const job of jobs) {
        try {
            job.autoConfirmedAt = new Date();
            job.pushStatus('CUSTOMER_CONFIRMED', 'system',
                `Confirmed automatically — no response from the customer in ${hours}h`);

            const nothingToPay = !(Number(job.finalAmount) > 0);

            if (job.paymentMode === 'cash' || nothingToPay) {
                job.paymentStatus = 'paid';
                job.paidAt = new Date();
                job.pushStatus('PAYMENT_COMPLETED', 'system',
                    nothingToPay
                        ? 'Nothing to pay'
                        : `₹${job.finalAmount} collected in cash on site`);

                const result = await Settlement.settle(job);
                job.pushStatus('CLOSED', 'system',
                    result.ok ? 'Settled' : `Settlement deferred: ${result.reason}`);
                await job.save();

                notify(job.customerId, 'user', 'Job closed',
                    `${job.jobCode} was confirmed automatically after ${hours}h. Final bill ₹${job.finalAmount}.`);
                notify(job.providerId, 'provider', 'Insta Work payment received',
                    `₹${job.finalAmount} settled for ${job.jobCode}.`);
                emitJob(job, 'INSTA_JOB_CLOSED', { finalAmount: job.finalAmount });
            } else {
                // Online, and genuinely unpaid.
                await job.save();

                notify(job.customerId, 'user', 'Payment due',
                    `${job.jobCode} was confirmed automatically after ${hours}h. Please pay ₹${job.finalAmount}.`);
                notify(job.providerId, 'provider', 'Work confirmed',
                    `${job.jobCode} was confirmed automatically. Awaiting the customer's payment of ₹${job.finalAmount}.`);
                emitJob(job, 'INSTA_WORK_CONFIRMED', { finalAmount: job.finalAmount });
            }

            confirmed += 1;
        } catch (err) {
            // One bad job must not stop the rest of the sweep.
            console.error(`[InstaWork] auto-confirm failed for ${job.jobCode}:`, err.message);
        }
    }
    return confirmed;
};

const sweep = async () => {
    const [expired, cancelled, confirmed] = await Promise.all([
        expirePendingExtensions(),
        cancelUnmatchedJobs(),
        autoConfirmAbandonedJobs()
    ]);
    if (expired || cancelled || confirmed) {
        console.log(`[InstaWork] Sweep: ${expired} extension(s) expired, ${cancelled} unmatched job(s) cancelled, ${confirmed} finished job(s) auto-confirmed`);
    }
    return { expired, cancelled, confirmed };
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

module.exports = { startInstaCron, sweep, expirePendingExtensions, cancelUnmatchedJobs, autoConfirmAbandonedJobs };
