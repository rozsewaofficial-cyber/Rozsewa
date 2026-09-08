const Booking = require('../models/Booking');
const CoinWallet = require('../models/CoinWallet');
const CoinLot = require('../models/CoinLot');
const CoinLedger = require('../models/CoinLedger');
const CoinRedemption = require('../models/CoinRedemption');
const CoinService = require('./CoinService');

/**
 * Everything that decides WHEN coins are earned or taken back.
 *
 * CoinService owns the ledger primitives (credit / hold / commit / release);
 * this module owns the business rules layered on top — first-order and target
 * rewards, referral settlement, clawback and expiry.
 *
 * Every award here is keyed by a stable referenceId so CoinService's
 * idempotency index makes repeat invocation harmless. That matters because the
 * booking-completion path can legitimately be retried.
 */

/**
 * Counts orders that actually qualify for a reward.
 *
 * The spec's exclusions are explicit: cancelled, failed, rejected and refunded
 * orders never count. `status: 'completed'` covers the first three (a rejected
 * or failed booking never reaches 'completed'); the paymentStatus guard is what
 * excludes a completed-then-refunded order.
 */
const countEligibleOrders = async (matchKey, ownerId, since = null) => {
    const query = {
        [matchKey]: ownerId,
        status: 'completed',
        paymentStatus: { $ne: 'refunded' }
    };
    if (since) query.completedAt = { $gte: since };
    return await Booking.countDocuments(query);
};

/**
 * Awards every target the actor has newly crossed.
 *
 * Targets are cumulative thresholds, so we award any threshold at or below the
 * current count that hasn't been paid yet. Awarding by threshold (rather than
 * "the one we just crossed") is deliberate: if a completion event is ever
 * missed, the next one quietly backfills instead of stranding the reward.
 */
const awardTargets = async ({ ownerId, ownerType, ownerModel, config, count, periodKey, bookingId }) => {
    const rc = CoinService.roleConfig(config, ownerType);
    const targets = Array.isArray(rc.targets) ? rc.targets : [];
    const awarded = [];

    // The first-order double-credit rule: when the 1-order target would pay out
    // on the same order that already paid the First Order reward, skip it.
    let skipSingleOrderTarget = false;
    if (ownerType === 'customer' && !rc.countFirstOrderInTarget) {
        const firstOrderCredit = await CoinLedger.exists({
            ownerId,
            source: 'FIRST_ORDER',
            type: 'CREDIT'
        });
        skipSingleOrderTarget = Boolean(firstOrderCredit);
    }

    for (const target of targets) {
        const threshold = Number(target.orders) || 0;
        const coins = Number(target.coins) || 0;
        if (threshold <= 0 || coins <= 0) continue;
        if (count < threshold) continue;
        if (skipSingleOrderTarget && threshold <= 1) continue;

        const referenceId = `target:${periodKey}:${threshold}`;
        const row = await CoinService.credit({
            ownerId,
            ownerType,
            ownerModel,
            coins,
            source: 'TARGET_ACHIEVEMENT',
            referenceId,
            description: `Target reward for completing ${threshold} orders`,
            meta: { threshold, periodKey, bookingId: bookingId ? String(bookingId) : null }
        });
        if (row) awarded.push({ threshold, coins });
    }

    return awarded;
};

/**
 * Settles a pending referral once the referred customer's first order lands.
 *
 * The reward goes to the referrer, and only here — never at signup — because
 * the spec ties it to the referred user completing a paid order. Anti-fraud
 * checks run at this moment rather than at signup so that a shared device or IP
 * discovered later still blocks the payout.
 */
const settleReferral = async (customer, booking, config) => {
    if (!customer || !customer.referredBy || customer.referralRewarded) return null;

    const User = require('../models/User');
    const referrer = await User.findOne({ referralCode: customer.referredBy });
    if (!referrer) return null;

    const af = config.antiFraud || {};
    const blockedFor = [];

    if (af.blockSelfReferral) {
        if (referrer._id.toString() === customer._id.toString()) blockedFor.push('self-referral');
        if (referrer.mobile && customer.mobile && referrer.mobile === customer.mobile) blockedFor.push('same mobile');
        if (referrer.email && customer.email && referrer.email === customer.email) blockedFor.push('same email');
    }
    if (af.blockSameDevice && referrer.signupDeviceId && customer.signupDeviceId
        && referrer.signupDeviceId === customer.signupDeviceId) {
        blockedFor.push('same device');
    }
    if (af.blockSameIp && referrer.signupIp && customer.signupIp
        && referrer.signupIp === customer.signupIp) {
        blockedFor.push('same IP');
    }

    if (blockedFor.length === 0 && af.maxReferralsPerDay) {
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        const todayCount = await CoinLedger.countDocuments({
            ownerId: referrer._id,
            source: 'REFERRAL_REWARD',
            type: 'CREDIT',
            createdAt: { $gte: since }
        });
        if (todayCount >= Number(af.maxReferralsPerDay)) blockedFor.push('daily referral cap reached');
    }

    if (blockedFor.length > 0) {
        console.warn(`[Coins] Referral reward blocked for referrer ${referrer._id} via ${customer._id}: ${blockedFor.join(', ')}`);
        // Mark it settled so the check doesn't re-run on every future order.
        customer.referralRewarded = true;
        customer.referralBlockedReason = blockedFor.join(', ');
        await customer.save();
        return null;
    }

    const coins = Number(config.customer.referralReward) || 0;
    const row = await CoinService.credit({
        ownerId: referrer._id,
        ownerType: 'customer',
        ownerModel: 'User',
        coins,
        source: 'REFERRAL_REWARD',
        // Keyed on the referred user, so one referral can only ever pay once.
        referenceId: customer._id.toString(),
        referenceModel: 'User',
        description: `Referral reward for ${customer.name || 'a referred customer'} completing their first order`,
        meta: { referredUserId: customer._id.toString(), triggerBookingId: String(booking._id) }
    });

    customer.referralRewarded = true;
    await customer.save();

    if (row) {
        try {
            const { notifyUser } = require('../config/notificationService');
            await notifyUser({
                userId: referrer._id,
                userRole: 'user',
                title: 'Referral reward earned!',
                message: `You earned ${coins} RozSewa Coins because ${customer.name || 'your friend'} completed their first order.`,
                type: 'system'
            });
        } catch (err) {
            console.log('[Coins] Referral notification failed:', err.message);
        }
    }

    return row;
};

/**
 * The single entry point called after a booking is marked completed.
 *
 * Deliberately never throws: coins are a loyalty perk, and a failure to award
 * them must not roll back or fail a job that has genuinely been completed.
 * Callers invoke this after their money transaction has already committed.
 */
const onBookingCompleted = async (bookingId) => {
    try {
        const config = await CoinService.getConfig();
        if (!config.enabled) return;

        const booking = await Booking.findById(bookingId);
        if (!booking || booking.status !== 'completed') return;

        /* ---------------- Customer side ---------------- */
        const User = require('../models/User');
        const customer = await User.findById(booking.userId);

        if (customer) {
            const window = CoinService.periodWindow(config.customer.targetPeriod);
            const lifetimeCount = await countEligibleOrders('userId', customer._id);

            // First order reward — guarded on the count so it can only ever be
            // the genuine first, and keyed on the booking so retries are safe.
            if (lifetimeCount === 1) {
                await CoinService.credit({
                    ownerId: customer._id,
                    ownerType: 'customer',
                    ownerModel: 'User',
                    coins: Number(config.customer.firstOrderReward) || 0,
                    source: 'FIRST_ORDER',
                    referenceId: booking._id.toString(),
                    referenceModel: 'Booking',
                    description: `First order reward for ${booking.serviceName}`,
                    meta: { bookingId: booking._id.toString() }
                });
            }

            const periodCount = window.start
                ? await countEligibleOrders('userId', customer._id, window.start)
                : lifetimeCount;

            await awardTargets({
                ownerId: customer._id,
                ownerType: 'customer',
                ownerModel: 'User',
                config,
                count: periodCount,
                periodKey: window.key,
                bookingId: booking._id
            });

            await settleReferral(customer, booking, config);
        }

        /* ------------- Partner / Sewak side ------------- */
        if (booking.providerId) {
            const Provider = require('../models/Provider');
            const provider = await Provider.findById(booking.providerId);
            if (provider) {
                const ownerType = provider.providerCategory === 'sewak' ? 'sewak' : 'partner';
                const rc = CoinService.roleConfig(config, ownerType);
                const window = CoinService.periodWindow(rc.targetPeriod);
                const count = await countEligibleOrders(
                    'providerId',
                    provider._id,
                    window.start
                );

                await awardTargets({
                    ownerId: provider._id,
                    ownerType,
                    ownerModel: 'Provider',
                    config,
                    count,
                    periodKey: window.key,
                    bookingId: booking._id
                });
            }
        }
    } catch (err) {
        console.error('[Coins] onBookingCompleted failed:', err.message);
    }
};

/**
 * Clawback + refund when a completed order is later cancelled or refunded.
 *
 * Two separate things happen and both are required by the spec:
 *   1. coins the customer SPENT on the order are returned to them
 *   2. coins the order EARNED (for anyone) are taken back
 */
const onBookingReversed = async (bookingId, reason = 'Order cancelled or refunded') => {
    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        // 1. Give back what was spent.
        if (booking.coinRedemptionId) {
            try {
                await CoinService.release(booking.coinRedemptionId, reason);
            } catch (err) {
                console.error('[Coins] Failed to refund redeemed coins:', err.message);
            }
        }

        // 2. Take back what was earned off the back of this order.
        const bookingRef = booking._id.toString();
        const earned = await CoinLedger.find({
            type: 'CREDIT',
            source: { $in: ['FIRST_ORDER', 'TARGET_ACHIEVEMENT', 'REFERRAL_REWARD'] },
            $or: [
                { referenceId: bookingRef },
                { 'meta.bookingId': bookingRef },
                { 'meta.triggerBookingId': bookingRef }
            ]
        });

        for (const row of earned) {
            await clawback(row, reason);
        }
    } catch (err) {
        console.error('[Coins] onBookingReversed failed:', err.message);
    }
};

/**
 * Reverses a single earned-coin ledger row.
 *
 * If the user has already spent some of it we can only take back what is left —
 * a wallet is never driven negative. The shortfall is recorded on the reversal
 * row so finance can see exactly what could not be recovered.
 */
const clawback = async (ledgerRow, reason) => {
    // Already reversed? The unique reference makes this cheap to check.
    const existing = await CoinLedger.exists({
        ownerId: ledgerRow.ownerId,
        type: 'REVERSAL',
        source: 'CLAWBACK',
        referenceId: ledgerRow.transactionId
    });
    if (existing) return null;

    const config = await CoinService.getConfig();
    const wallet = await CoinWallet.findById(ledgerRow.walletId);
    if (!wallet) return null;

    const recoverable = Math.min(ledgerRow.coins, wallet.balance);
    const shortfall = ledgerRow.coins - recoverable;

    if (recoverable > 0) {
        // Take the coins out of the lots they were credited into where possible.
        let outstanding = recoverable;
        const lots = await CoinLot.find({
            walletId: wallet._id,
            status: 'active',
            remaining: { $gt: 0 }
        }).sort({ expiryDate: -1 });

        for (const lot of lots) {
            if (outstanding <= 0) break;
            const take = Math.min(lot.remaining, outstanding);
            const update = { $inc: { remaining: -take } };
            if (take === lot.remaining) update.$set = { status: 'exhausted' };
            await CoinLot.updateOne({ _id: lot._id }, update);
            outstanding -= take;
        }

        await CoinWallet.updateOne(
            { _id: wallet._id },
            { $inc: { balance: -recoverable, totalReversed: recoverable } }
        );
    }

    const after = await CoinWallet.findById(wallet._id);

    await CoinLedger.create({
        transactionId: CoinService.newTxnId('CX'),
        walletId: wallet._id,
        ownerId: ledgerRow.ownerId,
        ownerType: ledgerRow.ownerType,
        type: 'REVERSAL',
        coins: recoverable,
        monetaryValue: CoinService.toRupees(recoverable, config),
        conversionRatio: config.coinsPerRupee,
        source: 'CLAWBACK',
        referenceId: ledgerRow.transactionId,
        previousBalance: after.balance + recoverable,
        newBalance: after.balance,
        status: 'completed',
        description: `Clawback of ${ledgerRow.coins} coins (${ledgerRow.source}) - ${reason}`,
        meta: {
            originalTransactionId: ledgerRow.transactionId,
            originalSource: ledgerRow.source,
            originalCoins: ledgerRow.coins,
            shortfall
        }
    });

    if (shortfall > 0) {
        console.warn(`[Coins] Clawback shortfall of ${shortfall} coins for ${ledgerRow.ownerId} (already spent)`);
    }

    return { recoverable, shortfall };
};

/**
 * Daily expiry sweep. Retires every lot past its expiry date and writes one
 * EXPIRY row per lot so the user can see exactly what lapsed and when.
 */
const expireDueLots = async () => {
    const config = await CoinService.getConfig();
    const now = new Date();
    const due = await CoinLot.find({
        status: 'active',
        remaining: { $gt: 0 },
        expiryDate: { $lte: now }
    }).limit(5000);

    let expiredCoins = 0;

    for (const lot of due) {
        const claimed = await CoinLot.findOneAndUpdate(
            { _id: lot._id, status: 'active' },
            { $set: { status: 'expired' } },
            { new: false }
        );
        if (!claimed) continue; // another worker got it

        const coins = claimed.remaining;
        if (coins <= 0) continue;

        const wallet = await CoinWallet.findOneAndUpdate(
            { _id: lot.walletId },
            { $inc: { balance: -coins, totalExpired: coins } },
            { new: true }
        );
        if (!wallet) continue;

        // Guard against a balance that had already drifted below the lot total.
        if (wallet.balance < 0) {
            await CoinWallet.updateOne({ _id: wallet._id }, { $set: { balance: 0 } });
        }

        await CoinLedger.create({
            transactionId: CoinService.newTxnId('CE'),
            walletId: wallet._id,
            ownerId: wallet.ownerId,
            ownerType: wallet.ownerType,
            type: 'EXPIRY',
            coins,
            monetaryValue: CoinService.toRupees(coins, config),
            conversionRatio: config.coinsPerRupee,
            source: 'EXPIRY',
            referenceId: lot._id.toString(),
            referenceModel: 'CoinLot',
            previousBalance: wallet.balance + coins,
            newBalance: Math.max(0, wallet.balance),
            status: 'completed',
            description: `${coins} coins expired`
        });

        expiredCoins += coins;
    }

    if (due.length) {
        console.log(`[Coins] Expiry sweep retired ${due.length} lots (${expiredCoins} coins)`);
    }
    return { lots: due.length, coins: expiredCoins };
};

/**
 * Returns coins from checkout holds that were never completed. Without this an
 * abandoned Razorpay window would keep someone's balance reserved forever.
 */
const releaseStaleHolds = async () => {
    const stale = await CoinRedemption.find({
        status: 'held',
        expiresAt: { $lte: new Date() }
    }).limit(1000);

    for (const redemption of stale) {
        try {
            await CoinService.release(redemption._id, 'Checkout was not completed in time');
        } catch (err) {
            console.error(`[Coins] Failed to release stale hold ${redemption._id}:`, err.message);
        }
    }

    if (stale.length) console.log(`[Coins] Released ${stale.length} stale holds`);
    return stale.length;
};

module.exports = {
    countEligibleOrders,
    awardTargets,
    settleReferral,
    onBookingCompleted,
    onBookingReversed,
    clawback,
    expireDueLots,
    releaseStaleHolds
};
