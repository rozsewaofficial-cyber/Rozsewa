const mongoose = require('mongoose');
const Setting = require('../models/Setting');
const CoinWallet = require('../models/CoinWallet');
const CoinLot = require('../models/CoinLot');
const CoinLedger = require('../models/CoinLedger');
const CoinRedemption = require('../models/CoinRedemption');

const CONFIG_KEY = 'coins_config';

// How long a hold survives before the sweeper returns the coins. Long enough to
// finish a Razorpay checkout, short enough that an abandoned cart doesn't strand
// someone's balance for the rest of the day.
const HOLD_TTL_MINUTES = 30;

/**
 * Shipping defaults straight from the spec. Everything here is admin
 * configurable at runtime, so these are only what a fresh install starts with —
 * and the backstop if the Setting row is ever missing or malformed.
 */
const DEFAULT_CONFIG = {
    enabled: true,
    // 10 coins = Rs 1.
    coinsPerRupee: 10,
    customer: {
        referralReward: 200,
        firstOrderReward: 100,
        // When false (the default), an order that already paid out the First
        // Order reward will not also pay out the 1-Order target.
        countFirstOrderInTarget: false,
        targets: [
            { orders: 1, coins: 100 },
            { orders: 5, coins: 300 },
            { orders: 10, coins: 700 },
            { orders: 25, coins: 2000 },
            { orders: 50, coins: 5000 }
        ],
        targetPeriod: 'lifetime',   // lifetime | daily | weekly | monthly
        maxDiscountPercent: 20,
        minOrderValue: 199,
        minRedemption: 0,
        expiryDays: 90
    },
    partner: {
        targets: [
            { orders: 10, coins: 100 },
            { orders: 25, coins: 300 },
            { orders: 50, coins: 750 },
            { orders: 100, coins: 1500 }
        ],
        targetPeriod: 'lifetime',
        maxDiscountPercent: 50,
        minRedemption: 500,
        expiryDays: 60
    },
    sewak: {
        targets: [
            { orders: 10, coins: 100 },
            { orders: 25, coins: 300 },
            { orders: 50, coins: 750 },
            { orders: 100, coins: 1500 }
        ],
        targetPeriod: 'lifetime',
        maxDiscountPercent: 50,
        minRedemption: 500,
        expiryDays: 60
    },
    antiFraud: {
        blockSelfReferral: true,
        blockSameDevice: true,
        blockSameIp: true,
        // A referrer can only bank this many referral rewards per day.
        maxReferralsPerDay: 10
    }
};

const deepDefault = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
    if (fallback && typeof fallback === 'object') {
        const merged = { ...fallback };
        for (const key of Object.keys(fallback)) {
            merged[key] = deepDefault(value[key], fallback[key]);
        }
        return merged;
    }
    return value;
};

/** Reads the live config, always returning a fully-populated object. */
const getConfig = async () => {
    try {
        const row = await Setting.findOne({ key: CONFIG_KEY }).lean();
        if (!row || !row.value) return deepDefault({}, DEFAULT_CONFIG);
        const raw = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        return deepDefault(raw, DEFAULT_CONFIG);
    } catch (err) {
        console.error('[CoinService] Failed to read config, using defaults:', err.message);
        return deepDefault({}, DEFAULT_CONFIG);
    }
};

const saveConfig = async (partial) => {
    const current = await getConfig();
    const next = deepDefault(partial, current);
    // A ratio of 0 would make every coin infinitely valuable — refuse it
    // outright rather than letting a typo detonate the discount maths.
    if (!next.coinsPerRupee || Number(next.coinsPerRupee) <= 0) {
        throw new Error('coinsPerRupee must be greater than zero');
    }
    next.coinsPerRupee = Number(next.coinsPerRupee);
    await Setting.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value: next, updatedAt: new Date() },
        { upsert: true }
    );
    return next;
};

/** Per-role slice of the config. Partner and Sewak have separate blocks. */
const roleConfig = (config, ownerType) => config[ownerType] || config.customer;

const toRupees = (coins, config) => {
    const ratio = Number(config.coinsPerRupee) || 10;
    // Floor: never round a redemption up past what the coins are actually worth.
    return Math.floor((Number(coins) || 0) / ratio);
};

const toCoins = (rupees, config) => {
    const ratio = Number(config.coinsPerRupee) || 10;
    return Math.round((Number(rupees) || 0) * ratio);
};

/**
 * Maps an authenticated principal (req.user) onto its wallet identity.
 * Sewaks and Partners are both Provider documents distinguished only by
 * providerCategory, which is exactly the distinction the reward tables need.
 */
const resolveOwner = (principal) => {
    if (!principal) return null;
    const role = principal.role;
    if (role === 'provider' || principal.providerCategory) {
        const ownerType = principal.providerCategory === 'sewak' ? 'sewak' : 'partner';
        return { ownerId: principal._id, ownerType, ownerModel: 'Provider' };
    }
    // Staff roles have no coin wallet of their own.
    if (['admin', 'superadmin', 'supervisor', 'employee', 'field_staff', 'wfh'].includes(role)) {
        return null;
    }
    return { ownerId: principal._id, ownerType: 'customer', ownerModel: 'User' };
};

const getOrCreateWallet = async (ownerId, ownerType, ownerModel) => {
    let wallet = await CoinWallet.findOne({ ownerId });
    if (wallet) return wallet;

    try {
        return await CoinWallet.create({ ownerId, ownerType, ownerModel });
    } catch (err) {
        // Unique index on ownerId — another request created it first.
        if (err.code === 11000) return await CoinWallet.findOne({ ownerId });
        throw err;
    }
};

const newTxnId = (prefix) => `${prefix}-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;

/** Boundaries for a period-scoped target window. */
const periodWindow = (period) => {
    const now = new Date();
    if (period === 'daily') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start, key: start.toISOString().slice(0, 10) };
    }
    if (period === 'weekly') {
        const start = new Date(now);
        const dayOffset = (start.getDay() + 6) % 7; // week starts Monday
        start.setDate(start.getDate() - dayOffset);
        start.setHours(0, 0, 0, 0);
        return { start, key: `w${start.toISOString().slice(0, 10)}` };
    }
    if (period === 'monthly') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, key: `m${start.toISOString().slice(0, 7)}` };
    }
    return { start: null, key: 'lifetime' };
};

/* ------------------------------- CREDIT ------------------------------- */

/**
 * Credits coins and opens an expiry lot. Idempotent for reward sources: the
 * unique (ownerId, source, referenceId) ledger index makes a repeat call a
 * no-op rather than a double payout, which is what lets callers retry freely.
 *
 * Returns the ledger row, or null when the credit was a duplicate or zero.
 */
const credit = async ({
    ownerId, ownerType, ownerModel, coins, source, referenceId = null,
    referenceModel = null, description = '', meta = {}, actorId = null,
    actorName = null, reason = null, expiryDays = null
}) => {
    const amount = Math.floor(Number(coins) || 0);
    if (amount <= 0) return null;

    const config = await getConfig();
    const wallet = await getOrCreateWallet(ownerId, ownerType, ownerModel);
    const rc = roleConfig(config, wallet.ownerType);

    const days = expiryDays !== null ? Number(expiryDays) : Number(rc.expiryDays) || 90;
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Reserve the ledger row FIRST. If this collides on the idempotency index
    // the credit already happened and we must not touch the balance or lots.
    let ledgerRow;
    try {
        ledgerRow = await CoinLedger.create({
            transactionId: newTxnId('CC'),
            walletId: wallet._id,
            ownerId,
            ownerType: wallet.ownerType,
            type: 'CREDIT',
            coins: amount,
            monetaryValue: toRupees(amount, config),
            conversionRatio: config.coinsPerRupee,
            source,
            referenceId: referenceId ? String(referenceId) : null,
            referenceModel,
            previousBalance: wallet.balance,
            newBalance: wallet.balance + amount,
            status: 'completed',
            description,
            expiryDate,
            meta,
            actorId,
            actorName,
            reason
        });
    } catch (err) {
        if (err.code === 11000) {
            console.log(`[CoinService] Duplicate ${source} credit for ${ownerId} ref=${referenceId} - skipped`);
            return null;
        }
        throw err;
    }

    await CoinLot.create({
        walletId: wallet._id,
        ownerId,
        coins: amount,
        remaining: amount,
        source,
        referenceId: referenceId ? String(referenceId) : null,
        expiryDate
    });

    const updated = await CoinWallet.findOneAndUpdate(
        { _id: wallet._id },
        { $inc: { balance: amount, totalEarned: amount } },
        { new: true }
    );

    // The pre-read balance can be stale under concurrency; correct the ledger
    // row to the authoritative post-increment values.
    if (updated && updated.balance !== ledgerRow.newBalance) {
        await CoinLedger.updateOne(
            { _id: ledgerRow._id },
            { previousBalance: updated.balance - amount, newBalance: updated.balance }
        );
    }

    return ledgerRow;
};

/* -------------------------------- QUOTE ------------------------------- */

/** The subset of config that is safe and useful to hand to a client. */
const publicConfig = (config, ownerType) => {
    const rc = roleConfig(config, ownerType || 'customer');
    return {
        enabled: config.enabled,
        coinsPerRupee: config.coinsPerRupee,
        maxDiscountPercent: rc.maxDiscountPercent,
        minOrderValue: rc.minOrderValue || 0,
        minRedemption: rc.minRedemption || 0,
        expiryDays: rc.expiryDays,
        targets: rc.targets || []
    };
};

/**
 * How many coins may be spent against `amount`, without moving anything.
 * This is the single source of truth for the discount cap — the client never
 * computes it, it only displays what this returns.
 */
const quote = async ({ ownerId, ownerType, ownerModel, amount, purpose }) => {
    const config = await getConfig();
    const grossAmount = Number(amount) || 0;

    const deny = (reason) => ({
        eligible: false,
        reason,
        maxCoins: 0,
        maxDiscount: 0,
        balance: 0,
        balanceValue: 0,
        config: publicConfig(config, ownerType)
    });

    if (!config.enabled) return deny('The RozSewa Coins programme is currently unavailable.');

    // Role isolation - enforced here and again at hold() time.
    if (purpose === 'order' && ownerType !== 'customer') {
        return deny('Partner and Sewak coins can only be used for subscription discounts.');
    }
    if (purpose === 'subscription' && ownerType === 'customer') {
        return deny('Customer coins can only be used for order discounts.');
    }

    const wallet = await getOrCreateWallet(ownerId, ownerType, ownerModel);
    const rc = roleConfig(config, wallet.ownerType);
    const balanceValue = toRupees(wallet.balance, config);

    const base = {
        balance: wallet.balance,
        balanceValue,
        config: publicConfig(config, wallet.ownerType)
    };

    if (wallet.isFrozen) {
        return { ...deny('This coin wallet is currently frozen. Please contact support.'), ...base };
    }
    if (purpose === 'order' && grossAmount < (Number(rc.minOrderValue) || 0)) {
        return {
            ...base,
            eligible: false,
            maxCoins: 0,
            maxDiscount: 0,
            reason: `Coins can be applied on orders of Rs ${rc.minOrderValue} or more.`
        };
    }
    if (wallet.balance < (Number(rc.minRedemption) || 0)) {
        return {
            ...base,
            eligible: false,
            maxCoins: 0,
            maxDiscount: 0,
            reason: `You need at least ${rc.minRedemption} coins to redeem.`
        };
    }

    // Cap is the lesser of (a) the configured % of the bill and (b) what the
    // wallet actually holds. Floored to a whole rupee, then converted back to
    // whole coins so the two figures always agree exactly.
    const percentCap = Math.floor((grossAmount * (Number(rc.maxDiscountPercent) || 0)) / 100);
    const maxDiscount = Math.max(0, Math.min(percentCap, balanceValue));
    const maxCoins = toCoins(maxDiscount, config);

    return {
        ...base,
        eligible: maxCoins > 0,
        reason: maxCoins > 0 ? null : 'You do not have enough coins to apply a discount on this amount.',
        maxCoins,
        maxDiscount
    };
};

/* -------------------------------- HOLD -------------------------------- */

/**
 * Reserves coins for an in-flight order/subscription. Consumes lots FIFO by
 * expiry and decrements the balance under an atomic guard, so two concurrent
 * checkouts can never both spend the same coins.
 *
 * Nothing here is final: the caller must later commit() or release().
 */
const hold = async ({ ownerId, ownerType, ownerModel, coins, amount, purpose }) => {
    const requested = Math.floor(Number(coins) || 0);
    if (!Number.isFinite(requested) || requested <= 0) {
        throw new Error('Coins to redeem must be a positive whole number.');
    }

    const q = await quote({ ownerId, ownerType, ownerModel, amount, purpose });
    if (!q.eligible) throw new Error(q.reason || 'Coins cannot be applied to this payment.');
    if (requested > q.maxCoins) {
        throw new Error(`You can apply at most ${q.maxCoins} coins (Rs ${q.maxDiscount}) on this amount.`);
    }

    const config = await getConfig();
    const wallet = await getOrCreateWallet(ownerId, ownerType, ownerModel);

    // Atomic conditional decrement — the guard is what prevents an overdraft
    // when two requests race, with or without a replica-set transaction.
    const debited = await CoinWallet.findOneAndUpdate(
        { _id: wallet._id, balance: { $gte: requested }, isFrozen: false },
        { $inc: { balance: -requested } },
        { new: true }
    );
    if (!debited) throw new Error('Insufficient coin balance.');

    // Drain lots soonest-expiry-first so the user spends what they'd lose next.
    const consumption = [];
    let outstanding = requested;
    let guard = 0;
    while (outstanding > 0 && guard < 500) {
        guard += 1;
        const lot = await CoinLot.findOne({
            walletId: wallet._id,
            status: 'active',
            remaining: { $gt: 0 }
        }).sort({ expiryDate: 1, createdAt: 1 });

        if (!lot) break;

        const take = Math.min(lot.remaining, outstanding);
        const update = { $inc: { remaining: -take } };
        if (take === lot.remaining) update.$set = { status: 'exhausted' };

        const claimed = await CoinLot.findOneAndUpdate(
            { _id: lot._id, remaining: { $gte: take } },
            update,
            { new: true }
        );
        if (!claimed) continue; // lost the race for this lot, try the next

        consumption.push({ lotId: lot._id, coins: take });
        outstanding -= take;
    }

    if (outstanding > 0) {
        // Lots and balance disagree — put everything back and refuse rather
        // than hand out a discount we can't account for.
        await CoinWallet.updateOne({ _id: wallet._id }, { $inc: { balance: requested } });
        for (const c of consumption) {
            await CoinLot.updateOne(
                { _id: c.lotId },
                { $inc: { remaining: c.coins }, $set: { status: 'active' } }
            );
        }
        throw new Error('Coin balance could not be reserved. Please try again.');
    }

    const monetaryValue = toRupees(requested, config);
    const redemption = await CoinRedemption.create({
        ownerId,
        ownerType: wallet.ownerType,
        walletId: wallet._id,
        purpose,
        coins: requested,
        monetaryValue,
        conversionRatio: config.coinsPerRupee,
        quotedAmount: Number(amount) || 0,
        lotConsumption: consumption,
        expiresAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000)
    });

    await CoinLedger.create({
        transactionId: newTxnId('CD'),
        walletId: wallet._id,
        ownerId,
        ownerType: wallet.ownerType,
        type: 'DEBIT',
        coins: requested,
        monetaryValue,
        conversionRatio: config.coinsPerRupee,
        source: purpose === 'order' ? 'ORDER_DISCOUNT' : 'SUB_DISCOUNT',
        referenceId: redemption._id.toString(),
        referenceModel: 'CoinRedemption',
        previousBalance: debited.balance + requested,
        newBalance: debited.balance,
        status: 'pending',
        description: `${requested} coins reserved for a ${purpose} discount of Rs ${monetaryValue}`
    });

    return { redemption, discount: monetaryValue, coins: requested, balance: debited.balance };
};

/**
 * Finalises a hold once the thing it paid for actually exists.
 * Re-validates the amount so a hold quoted against a large basket can't be
 * redirected onto a small one.
 */
const commit = async (redemptionId, { referenceId, referenceModel, amount = null } = {}) => {
    const redemption = await CoinRedemption.findById(redemptionId);
    if (!redemption) throw new Error('Coin redemption not found.');
    if (redemption.status === 'committed') return redemption; // idempotent
    if (redemption.status === 'released') throw new Error('This coin redemption has already been released.');

    if (amount !== null && Number(amount) < redemption.quotedAmount) {
        throw new Error('Order amount is lower than the amount these coins were reserved against.');
    }

    redemption.status = 'committed';
    redemption.committedAt = new Date();
    if (referenceId) redemption.referenceId = String(referenceId);
    if (referenceModel) redemption.referenceModel = referenceModel;
    await redemption.save();

    await CoinWallet.updateOne(
        { _id: redemption.walletId },
        { $inc: { totalUsed: redemption.coins } }
    );

    await CoinLedger.updateOne(
        { referenceId: redemption._id.toString(), type: 'DEBIT', status: 'pending' },
        {
            $set: {
                status: 'completed',
                description: `${redemption.coins} coins redeemed for a ${redemption.purpose} discount of Rs ${redemption.monetaryValue}`,
                'meta.referenceId': referenceId ? String(referenceId) : null,
                'meta.referenceModel': referenceModel || null
            }
        }
    );

    return redemption;
};

/**
 * Returns held (or already-committed, on refund) coins to their original lots,
 * preserving each lot's original expiry date.
 */
const release = async (redemptionId, reason = 'Payment not completed') => {
    const redemption = await CoinRedemption.findById(redemptionId);
    if (!redemption) return null;
    if (redemption.status === 'released') return redemption; // idempotent

    const wasCommitted = redemption.status === 'committed';
    const config = await getConfig();

    // Coins actually put back into their original lots. Coins whose lot has
    // since expired are re-issued as a fresh REFUND credit instead (below) and
    // are deliberately excluded here, so the REVERSAL row's before/after
    // balances stay exact rather than double-counting that credit.
    let restored = 0;

    for (const c of redemption.lotConsumption) {
        const lot = await CoinLot.findById(c.lotId);
        if (!lot) continue;
        // An expired lot's coins are genuinely gone — returning them would
        // resurrect value the user already lost. Credit a fresh lot instead so
        // the refund is honoured without rewriting expiry history.
        if (lot.status === 'expired' || lot.expiryDate <= new Date()) {
            await credit({
                ownerId: redemption.ownerId,
                ownerType: redemption.ownerType,
                ownerModel: redemption.ownerType === 'customer' ? 'User' : 'Provider',
                coins: c.coins,
                source: 'REFUND',
                referenceId: `${redemption._id}:${c.lotId}`,
                referenceModel: 'CoinRedemption',
                description: `Refund of ${c.coins} coins from an expired batch - ${reason}`
            });
            continue;
        }
        await CoinLot.updateOne(
            { _id: c.lotId },
            { $inc: { remaining: c.coins }, $set: { status: 'active' } }
        );
        await CoinWallet.updateOne(
            { _id: redemption.walletId },
            { $inc: { balance: c.coins } }
        );
        restored += c.coins;
    }

    const incs = { totalRefunded: redemption.coins };
    if (wasCommitted) incs.totalUsed = -redemption.coins;
    await CoinWallet.updateOne({ _id: redemption.walletId }, { $inc: incs });

    const wallet = await CoinWallet.findById(redemption.walletId);

    redemption.status = 'released';
    redemption.releasedAt = new Date();
    redemption.releaseReason = reason;
    await redemption.save();

    if (wasCommitted && restored > 0) {
        // A committed spend that is being undone gets its own REFUND row; the
        // original DEBIT row stays untouched because the ledger is immutable.
        await CoinLedger.create({
            transactionId: newTxnId('CR'),
            walletId: redemption.walletId,
            ownerId: redemption.ownerId,
            ownerType: redemption.ownerType,
            type: 'REVERSAL',
            coins: restored,
            monetaryValue: toRupees(restored, config),
            conversionRatio: config.coinsPerRupee,
            source: 'REFUND',
            referenceId: redemption._id.toString(),
            referenceModel: 'CoinRedemption',
            previousBalance: wallet ? wallet.balance - restored : 0,
            newBalance: wallet ? wallet.balance : 0,
            status: 'completed',
            description: `${restored} coins refunded - ${reason}`
        });
    } else if (!wasCommitted) {
        await CoinLedger.updateOne(
            { referenceId: redemption._id.toString(), type: 'DEBIT', status: 'pending' },
            { $set: { status: 'released', description: `Coin hold released - ${reason}` } }
        );
    }

    return redemption;
};

module.exports = {
    CONFIG_KEY,
    DEFAULT_CONFIG,
    HOLD_TTL_MINUTES,
    getConfig,
    saveConfig,
    roleConfig,
    publicConfig,
    toRupees,
    toCoins,
    resolveOwner,
    getOrCreateWallet,
    periodWindow,
    newTxnId,
    credit,
    quote,
    hold,
    commit,
    release
};
