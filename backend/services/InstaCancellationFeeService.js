const InstaJob = require('../models/InstaJob');

/**
 * Carries an unpaid cancellation fee onto the customer's next bill.
 *
 * The fee is charged when a customer abandons a job that a worker has already
 * committed to. Insta Work is post-paid and there is no saved payment method at
 * the moment of cancellation, so there is nothing to charge against right then
 * — the fee waits on the cancelled job and is added to the next job the same
 * customer completes.
 *
 * The fee is never the worker's. The worker who was cancelled on is almost never
 * the worker on the next job, so paying it to whoever happens to be there would
 * compensate the wrong person. It goes to the platform, and the payout for the
 * work itself is unaffected — see InstaSettlementService.
 */

/** Fees this customer owes that no later job has picked up yet. */
const outstandingFor = async (customerId) => {
    const rows = await InstaJob.find({
        customerId,
        status: 'CANCELLED',
        cancelledBy: 'customer',
        cancellationFee: { $gt: 0 },
        cancellationFeeStatus: 'pending'
    })
        .select('jobCode cancellationFee cancellationStage createdAt')
        .sort({ createdAt: 1 })
        // Few by design — a customer who racks up hundreds of unpaid fees is a
        // problem to investigate, not a list to load.
        .limit(200)
        .lean();

    return rows.map(r => ({
        jobId: r._id,
        jobCode: r.jobCode,
        amount: Number(r.cancellationFee) || 0
    }));
};

/**
 * Attaches the customer's outstanding fees to a job being billed.
 *
 * Claimed here, at bill time, rather than at payment: two jobs billed close
 * together would otherwise both quote the same fee and the customer would be
 * charged twice. The claim is conditional on the row still being pending, so
 * concurrent bills cannot both take it.
 */
const claimFor = async (job) => {
    const outstanding = await outstandingFor(job.customerId);
    if (!outstanding.length) return { recovered: [], total: 0 };

    const claimed = [];
    for (const fee of outstanding) {
        const res = await InstaJob.updateOne(
            { _id: fee.jobId, cancellationFeeStatus: 'pending' },
            { $set: { cancellationFeeStatus: 'collected', cancellationFeeCollectedBy: job._id } }
        );
        if (res.modifiedCount === 1) claimed.push(fee);
    }

    return {
        recovered: claimed,
        total: Math.round(claimed.reduce((s, f) => s + f.amount, 0) * 100) / 100
    };
};

/**
 * Puts fees back when the job that claimed them never gets paid.
 *
 * Without this a customer could cancel a job carrying someone else's fee and
 * clear the debt for free.
 */
const release = async (job) => {
    if (!job?.recoveredFees?.length) return 0;
    const ids = job.recoveredFees.map(f => f.jobId);
    const res = await InstaJob.updateMany(
        { _id: { $in: ids }, cancellationFeeCollectedBy: job._id },
        { $set: { cancellationFeeStatus: 'pending' }, $unset: { cancellationFeeCollectedBy: '' } }
    );
    return res.modifiedCount;
};

/** The line the customer sees on their bill for a carried-over fee. */
const breakdownLine = (fee) => ({
    label: `Cancellation fee — ${fee.jobCode}`,
    amount: fee.amount
});

module.exports = { outstandingFor, claimFor, release, breakdownLine };
