const CoinService = require('../services/CoinService');
const CoinRewardService = require('../services/CoinRewardService');
const CoinLedger = require('../models/CoinLedger');
const CoinLot = require('../models/CoinLot');
const CoinRedemption = require('../models/CoinRedemption');
const User = require('../models/User');
const Booking = require('../models/Booking');

/**
 * Resolves the caller's coin identity, or sends the 403 itself.
 * Returns null when the caller has no wallet (staff roles), so callers can
 * simply `if (!owner) return;`.
 */
const requireOwner = (req, res) => {
    const owner = CoinService.resolveOwner(req.user);
    if (!owner) {
        res.status(403).json({ message: 'This account type does not have a RozSewa Coins wallet.' });
        return null;
    }
    return owner;
};

// @desc    Wallet dashboard - balance, lifetime aggregates and what's expiring
// @route   GET /api/coins/wallet
// @access  Private (Customer / Partner / Sewak)
const getMyWallet = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;

        const config = await CoinService.getConfig();
        const wallet = await CoinService.getOrCreateWallet(owner.ownerId, owner.ownerType, owner.ownerModel);

        // What lapses in the next 14 days, so the UI can nudge before it's lost.
        const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const expiringLots = await CoinLot.find({
            walletId: wallet._id,
            status: 'active',
            remaining: { $gt: 0 },
            expiryDate: { $lte: soon }
        }).sort({ expiryDate: 1 }).lean();

        const expiringSoon = expiringLots.reduce((sum, lot) => sum + lot.remaining, 0);

        res.json({
            enabled: config.enabled,
            ownerType: wallet.ownerType,
            balance: wallet.balance,
            balanceValue: CoinService.toRupees(wallet.balance, config),
            totalEarned: wallet.totalEarned,
            totalUsed: wallet.totalUsed,
            totalExpired: wallet.totalExpired,
            totalRefunded: wallet.totalRefunded,
            totalReversed: wallet.totalReversed,
            isFrozen: wallet.isFrozen,
            freezeReason: wallet.freezeReason,
            expiringSoon,
            nextExpiryDate: expiringLots.length ? expiringLots[0].expiryDate : null,
            // What these coins may be spent on, so the UI never has to guess.
            redeemableFor: wallet.ownerType === 'customer' ? 'order' : 'subscription',
            config: CoinService.publicConfig(config, wallet.ownerType)
        });
    } catch (error) {
        console.error('[Coins] getMyWallet failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Paginated coin history
// @route   GET /api/coins/history
// @access  Private (Customer / Partner / Sewak)
const getMyHistory = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

        const query = { ownerId: owner.ownerId };
        // Only settled movements belong in the customer-facing history.
        //   pending  — a hold that is still in flight; nothing has been spent
        //   released — a hold that was handed back; showing it as a debit made
        //              an abandoned checkout look like coins the user had spent
        // Both remain queryable for support/debugging via includePending=true.
        if (req.query.includePending !== 'true') query.status = 'completed';
        if (req.query.type) query.type = req.query.type;
        if (req.query.source) query.source = req.query.source;

        const [entries, total] = await Promise.all([
            CoinLedger.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CoinLedger.countDocuments(query)
        ]);

        res.json({ entries, total, page, pages: Math.ceil(total / limit) || 1 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    How many coins can be applied to a given amount
// @route   POST /api/coins/quote
// @access  Private (Customer / Partner / Sewak)
const getQuote = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;

        const { amount, purpose } = req.body;
        if (!['order', 'subscription'].includes(purpose)) {
            return res.status(400).json({ message: 'purpose must be either "order" or "subscription".' });
        }
        if (amount === undefined || isNaN(Number(amount)) || Number(amount) < 0) {
            return res.status(400).json({ message: 'A valid amount is required.' });
        }

        const result = await CoinService.quote({ ...owner, amount: Number(amount), purpose });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reserve coins for an in-flight checkout. Coins leave the spendable
//          balance now, but are only finally spent once the order/subscription
//          is confirmed - a failed payment releases them untouched.
// @route   POST /api/coins/hold
// @access  Private (Customer / Partner / Sewak)
const createHold = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;

        const { coins, amount, purpose } = req.body;
        if (!['order', 'subscription'].includes(purpose)) {
            return res.status(400).json({ message: 'purpose must be either "order" or "subscription".' });
        }

        const result = await CoinService.hold({
            ...owner,
            coins: Number(coins),
            amount: Number(amount),
            purpose
        });

        res.status(201).json({
            redemptionId: result.redemption._id,
            coins: result.coins,
            discount: result.discount,
            balance: result.balance,
            expiresAt: result.redemption.expiresAt
        });
    } catch (error) {
        // These are all user-facing validation failures, not server faults.
        res.status(400).json({ message: error.message });
    }
};

// @desc    Hand back a hold whose checkout was abandoned or whose payment failed
// @route   POST /api/coins/release
// @access  Private (Customer / Partner / Sewak)
const releaseHold = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;

        const { redemptionId, reason } = req.body;
        const redemption = await CoinRedemption.findById(redemptionId);
        if (!redemption) return res.status(404).json({ message: 'Coin redemption not found.' });
        if (redemption.ownerId.toString() !== owner.ownerId.toString()) {
            return res.status(403).json({ message: 'Not authorized for this redemption.' });
        }
        // Only an unspent hold may be released this way. Undoing a committed
        // spend is a refund, and refunds are driven by the booking lifecycle.
        if (redemption.status !== 'held') {
            return res.status(400).json({ message: `This redemption is already ${redemption.status}.` });
        }

        await CoinService.release(redemptionId, reason || 'Payment not completed');
        res.json({ message: 'Coins returned to your wallet.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** Builds a readable, collision-checked referral code. */
const generateReferralCode = async (user) => {
    const base = (user.name || 'ROJ')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 6) || 'ROJ';

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        const code = `${base}${suffix}`;
        const clash = await User.exists({ referralCode: code });
        if (!clash) return code;
    }
    // Vanishingly unlikely, but never hand back a code we know collides.
    return `ROJ${Date.now().toString(36).toUpperCase()}`;
};

// @desc    The caller's referral code and how it's performing
// @route   GET /api/coins/referral
// @access  Private (Customer)
const getMyReferral = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;
        if (owner.ownerType !== 'customer') {
            return res.status(403).json({ message: 'Referrals are available to customers only.' });
        }

        const user = await User.findById(owner.ownerId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Codes are minted lazily on first view rather than at signup, so
        // existing accounts pick one up without a migration.
        if (!user.referralCode) {
            user.referralCode = await generateReferralCode(user);
            await user.save();
        }

        const config = await CoinService.getConfig();
        const referred = await User.find({ referredBy: user.referralCode })
            .select('name createdAt referralRewarded')
            .sort({ createdAt: -1 })
            .lean();

        const earnedRows = await CoinLedger.find({
            ownerId: user._id,
            source: 'REFERRAL_REWARD',
            type: 'CREDIT'
        }).lean();
        const coinsEarned = earnedRows.reduce((sum, r) => sum + r.coins, 0);

        res.json({
            referralCode: user.referralCode,
            // Whether this customer themselves signed up under someone's code —
            // drives whether the "were you invited?" input is still offered.
            referredBy: user.referredBy || null,
            rewardCoins: config.customer.referralReward,
            rewardValue: CoinService.toRupees(config.customer.referralReward, config),
            // Spelled out because the reward is not paid at signup.
            condition: 'Your reward is credited once your friend completes their first order.',
            totalReferred: referred.length,
            totalRewarded: referred.filter(r => r.referralRewarded).length,
            pending: referred.filter(r => !r.referralRewarded).length,
            coinsEarned,
            referrals: referred.map(r => ({
                name: r.name,
                joinedAt: r.createdAt,
                rewarded: r.referralRewarded
            }))
        });
    } catch (error) {
        console.error('[Coins] getMyReferral failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Attach a referrer to the caller's account
// @route   POST /api/coins/referral/apply
// @access  Private (Customer)
const applyReferralCode = async (req, res) => {
    try {
        const owner = requireOwner(req, res);
        if (!owner) return;
        if (owner.ownerType !== 'customer') {
            return res.status(403).json({ message: 'Referrals are available to customers only.' });
        }

        const code = String(req.body.code || '').toUpperCase().trim();
        if (!code) return res.status(400).json({ message: 'A referral code is required.' });

        const user = await User.findById(owner.ownerId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.referredBy) {
            return res.status(400).json({ message: 'A referral code has already been applied to your account.' });
        }
        if (user.referralCode && user.referralCode === code) {
            return res.status(400).json({ message: 'You cannot refer yourself.' });
        }

        const referrer = await User.findOne({ referralCode: code });
        if (!referrer) return res.status(404).json({ message: 'That referral code is not valid.' });
        if (referrer._id.toString() === user._id.toString()) {
            return res.status(400).json({ message: 'You cannot refer yourself.' });
        }

        // A referral has to precede the referred user's first order, otherwise
        // existing customers could retro-claim each other indefinitely.
        const completed = await Booking.countDocuments({
            userId: user._id,
            status: 'completed',
            paymentStatus: { $ne: 'refunded' }
        });
        if (completed > 0) {
            return res.status(400).json({
                message: 'Referral codes can only be applied before your first completed order.'
            });
        }

        user.referredBy = code;
        // Record the signup fingerprint now if we never captured one, so the
        // anti-fraud checks have something to compare at payout time.
        if (!user.signupIp) {
            user.signupIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        }
        if (!user.signupDeviceId && req.body.deviceId) {
            user.signupDeviceId = String(req.body.deviceId).slice(0, 128);
        }
        await user.save();

        const config = await CoinService.getConfig();
        res.json({
            message: `Referral code applied. ${referrer.name || 'Your friend'} earns ${config.customer.referralReward} coins once you complete your first order.`,
            referredBy: code
        });
    } catch (error) {
        console.error('[Coins] applyReferralCode failed:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMyWallet,
    getMyHistory,
    getQuote,
    createHold,
    releaseHold,
    getMyReferral,
    applyReferralCode,
    generateReferralCode
};
