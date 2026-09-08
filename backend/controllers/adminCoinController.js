const mongoose = require('mongoose');
const CoinService = require('../services/CoinService');
const CoinRewardService = require('../services/CoinRewardService');
const CoinWallet = require('../models/CoinWallet');
const CoinLedger = require('../models/CoinLedger');
const CoinLot = require('../models/CoinLot');
const User = require('../models/User');
const Provider = require('../models/Provider');
const AuditLog = require('../models/AuditLog');

/**
 * Writes the platform audit trail entry for a coin action. Manual coin
 * movements are exactly the sort of thing that gets questioned months later,
 * so every one of them lands in AuditLog as well as the coin ledger.
 */
const logAdminCoinAction = async (req, actionType, entityId, entityName, details) => {
    try {
        await AuditLog.create({
            actionType,
            entityType: 'COIN_WALLET',
            entityId,
            entityName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || 'Admin',
            verifiedByRole: req.user.role || 'admin',
            details
        });
    } catch (err) {
        console.error('[Coins] Audit log write failed:', err.message);
    }
};

// @desc    Read the whole coin configuration
// @route   GET /api/admin/coins/config
// @access  Private (Admin)
const getCoinConfig = async (req, res) => {
    try {
        const config = await CoinService.getConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update the coin configuration (partial updates are merged)
// @route   PUT /api/admin/coins/config
// @access  Private (Admin)
const updateCoinConfig = async (req, res) => {
    try {
        const before = await CoinService.getConfig();
        const saved = await CoinService.saveConfig(req.body || {});

        await logAdminCoinAction(
            req,
            'COIN_CONFIG_UPDATED',
            req.user._id,
            'RozSewa Coins configuration',
            { before, after: saved }
        );

        res.json({ message: 'Coin settings updated.', config: saved });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Programme-wide totals for the admin dashboard
// @route   GET /api/admin/coins/stats
// @access  Private (Admin)
const getCoinStats = async (req, res) => {
    try {
        const config = await CoinService.getConfig();

        const [byType, ledgerBySource, walletCount] = await Promise.all([
            CoinWallet.aggregate([
                {
                    $group: {
                        _id: '$ownerType',
                        wallets: { $sum: 1 },
                        balance: { $sum: '$balance' },
                        earned: { $sum: '$totalEarned' },
                        used: { $sum: '$totalUsed' },
                        expired: { $sum: '$totalExpired' }
                    }
                }
            ]),
            CoinLedger.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: { source: '$source', type: '$type' }, coins: { $sum: '$coins' }, count: { $sum: 1 } } }
            ]),
            CoinWallet.countDocuments()
        ]);

        const outstanding = byType.reduce((sum, row) => sum + row.balance, 0);

        res.json({
            enabled: config.enabled,
            coinsPerRupee: config.coinsPerRupee,
            walletCount,
            // The platform's open liability, in rupees, if every coin were spent.
            outstandingCoins: outstanding,
            outstandingValue: CoinService.toRupees(outstanding, config),
            byOwnerType: byType,
            bySource: ledgerBySource.map(r => ({
                source: r._id.source,
                type: r._id.type,
                coins: r.coins,
                count: r.count
            }))
        });
    } catch (error) {
        console.error('[Coins] getCoinStats failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Browse coin wallets, newest/richest first
// @route   GET /api/admin/coins/wallets
// @access  Private (Admin)
const getCoinWallets = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
        const query = {};
        if (req.query.ownerType) query.ownerType = req.query.ownerType;
        if (req.query.frozen === 'true') query.isFrozen = true;

        // A name/mobile search has to be resolved against the owning collection
        // first, since the wallet itself holds no identity fields.
        if (req.query.search) {
            const term = new RegExp(String(req.query.search).trim(), 'i');
            const [users, providers] = await Promise.all([
                User.find({ $or: [{ name: term }, { mobile: term }, { email: term }, { referralCode: term }] })
                    .select('_id').limit(200).lean(),
                Provider.find({ $or: [{ ownerName: term }, { shopName: term }, { mobile: term }] })
                    .select('_id').limit(200).lean()
            ]);
            query.ownerId = { $in: [...users, ...providers].map(d => d._id) };
        }

        const [wallets, total] = await Promise.all([
            CoinWallet.find(query).sort({ balance: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CoinWallet.countDocuments(query)
        ]);

        // Attach owner identity in two batched queries rather than per row.
        const userIds = wallets.filter(w => w.ownerModel === 'User').map(w => w.ownerId);
        const providerIds = wallets.filter(w => w.ownerModel === 'Provider').map(w => w.ownerId);
        const [users, providers] = await Promise.all([
            User.find({ _id: { $in: userIds } }).select('name mobile email referralCode').lean(),
            Provider.find({ _id: { $in: providerIds } }).select('ownerName shopName mobile').lean()
        ]);
        const ownerMap = new Map();
        users.forEach(u => ownerMap.set(u._id.toString(), { name: u.name, mobile: u.mobile, email: u.email, referralCode: u.referralCode }));
        providers.forEach(p => ownerMap.set(p._id.toString(), { name: p.ownerName, shopName: p.shopName, mobile: p.mobile }));

        const config = await CoinService.getConfig();

        res.json({
            wallets: wallets.map(w => ({
                ...w,
                balanceValue: CoinService.toRupees(w.balance, config),
                owner: ownerMap.get(w.ownerId.toString()) || null
            })),
            total,
            page,
            pages: Math.ceil(total / limit) || 1
        });
    } catch (error) {
        console.error('[Coins] getCoinWallets failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Full ledger for one wallet
// @route   GET /api/admin/coins/wallets/:ownerId/history
// @access  Private (Admin)
const getWalletHistory = async (req, res) => {
    try {
        const { ownerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            return res.status(400).json({ message: 'Invalid wallet owner id.' });
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

        const [wallet, entries, total, lots] = await Promise.all([
            CoinWallet.findOne({ ownerId }).lean(),
            CoinLedger.find({ ownerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            CoinLedger.countDocuments({ ownerId }),
            CoinLot.find({ ownerId, status: 'active', remaining: { $gt: 0 } }).sort({ expiryDate: 1 }).lean()
        ]);

        res.json({ wallet, entries, total, page, pages: Math.ceil(total / limit) || 1, activeLots: lots });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Works out an owner's wallet identity from an id alone, for admin actions
 * that address a user by id rather than by an authenticated principal.
 */
const resolveOwnerById = async (ownerId) => {
    const existing = await CoinWallet.findOne({ ownerId }).lean();
    if (existing) {
        return { ownerId: existing.ownerId, ownerType: existing.ownerType, ownerModel: existing.ownerModel };
    }
    const user = await User.findById(ownerId).select('role').lean();
    if (user) return { ownerId, ownerType: 'customer', ownerModel: 'User' };
    const provider = await Provider.findById(ownerId).select('providerCategory').lean();
    if (provider) {
        return {
            ownerId,
            ownerType: provider.providerCategory === 'sewak' ? 'sewak' : 'partner',
            ownerModel: 'Provider'
        };
    }
    return null;
};

// @desc    Manual credit or debit, with a mandatory reason
// @route   POST /api/admin/coins/adjust
// @access  Private (Admin)
const adjustWallet = async (req, res) => {
    try {
        const { ownerId, type, coins, reason, expiryDays } = req.body;

        if (!mongoose.Types.ObjectId.isValid(ownerId || '')) {
            return res.status(400).json({ message: 'A valid ownerId is required.' });
        }
        if (!['credit', 'debit'].includes(type)) {
            return res.status(400).json({ message: 'type must be either "credit" or "debit".' });
        }
        const amount = Math.floor(Number(coins));
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Coins must be a positive whole number.' });
        }
        // The spec makes this non-negotiable: no manual movement without a note.
        if (!reason || String(reason).trim().length < 3) {
            return res.status(400).json({ message: 'A reason is required for every manual coin adjustment.' });
        }

        const owner = await resolveOwnerById(ownerId);
        if (!owner) return res.status(404).json({ message: 'No user or provider found for that id.' });

        const config = await CoinService.getConfig();
        const note = String(reason).trim();

        if (type === 'credit') {
            const row = await CoinService.credit({
                ...owner,
                coins: amount,
                source: 'ADMIN_ADJUSTMENT',
                // Unique per action so repeat credits are allowed but auditable.
                referenceId: null,
                description: `Manual credit by admin: ${note}`,
                actorId: req.user._id,
                actorName: req.user.name || 'Admin',
                reason: note,
                expiryDays: expiryDays !== undefined ? Number(expiryDays) : null
            });

            await logAdminCoinAction(req, 'COIN_MANUAL_CREDIT', ownerId, `Credit ${amount} coins`, { coins: amount, reason: note });
            const wallet = await CoinWallet.findOne({ ownerId });
            return res.json({ message: `${amount} coins credited.`, balance: wallet.balance, entry: row });
        }

        // Debit: never drive a wallet negative, and take from the
        // soonest-expiring lots so the user keeps their longest-lived coins.
        const wallet = await CoinService.getOrCreateWallet(owner.ownerId, owner.ownerType, owner.ownerModel);
        if (wallet.balance < amount) {
            return res.status(400).json({ message: `Wallet only holds ${wallet.balance} coins.` });
        }

        let outstanding = amount;
        const lots = await CoinLot.find({
            walletId: wallet._id, status: 'active', remaining: { $gt: 0 }
        }).sort({ expiryDate: 1 });

        for (const lot of lots) {
            if (outstanding <= 0) break;
            const take = Math.min(lot.remaining, outstanding);
            const update = { $inc: { remaining: -take } };
            if (take === lot.remaining) update.$set = { status: 'exhausted' };
            await CoinLot.updateOne({ _id: lot._id }, update);
            outstanding -= take;
        }

        const updated = await CoinWallet.findOneAndUpdate(
            { _id: wallet._id, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );
        if (!updated) return res.status(400).json({ message: 'Insufficient coin balance.' });

        const entry = await CoinLedger.create({
            transactionId: CoinService.newTxnId('CA'),
            walletId: wallet._id,
            ownerId: wallet.ownerId,
            ownerType: wallet.ownerType,
            type: 'DEBIT',
            coins: amount,
            monetaryValue: CoinService.toRupees(amount, config),
            conversionRatio: config.coinsPerRupee,
            source: 'ADMIN_ADJUSTMENT',
            previousBalance: updated.balance + amount,
            newBalance: updated.balance,
            status: 'completed',
            description: `Manual debit by admin: ${note}`,
            actorId: req.user._id,
            actorName: req.user.name || 'Admin',
            reason: note
        });

        await logAdminCoinAction(req, 'COIN_MANUAL_DEBIT', ownerId, `Debit ${amount} coins`, { coins: amount, reason: note });
        res.json({ message: `${amount} coins debited.`, balance: updated.balance, entry });
    } catch (error) {
        console.error('[Coins] adjustWallet failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Freeze or unfreeze a wallet. A frozen wallet can still EARN coins -
//          it just cannot spend them - so freezing is a brake, not a penalty.
// @route   PATCH /api/admin/coins/wallets/:ownerId/freeze
// @access  Private (Admin)
const setWalletFreeze = async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { frozen, reason } = req.body;

        if (frozen && (!reason || String(reason).trim().length < 3)) {
            return res.status(400).json({ message: 'A reason is required when freezing a wallet.' });
        }

        const owner = await resolveOwnerById(ownerId);
        if (!owner) return res.status(404).json({ message: 'No user or provider found for that id.' });

        const wallet = await CoinService.getOrCreateWallet(owner.ownerId, owner.ownerType, owner.ownerModel);
        wallet.isFrozen = Boolean(frozen);
        wallet.freezeReason = frozen ? String(reason).trim() : null;
        wallet.frozenAt = frozen ? new Date() : null;
        wallet.frozenBy = frozen ? req.user._id : null;
        await wallet.save();

        await logAdminCoinAction(
            req,
            frozen ? 'COIN_WALLET_FROZEN' : 'COIN_WALLET_UNFROZEN',
            ownerId,
            frozen ? 'Wallet frozen' : 'Wallet unfrozen',
            { reason: wallet.freezeReason }
        );

        res.json({ message: frozen ? 'Wallet frozen.' : 'Wallet unfrozen.', wallet });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Run the expiry sweep on demand rather than waiting for the cron
// @route   POST /api/admin/coins/run-expiry
// @access  Private (Admin)
const runExpirySweep = async (req, res) => {
    try {
        const result = await CoinRewardService.expireDueLots();
        const released = await CoinRewardService.releaseStaleHolds();
        await logAdminCoinAction(req, 'COIN_EXPIRY_SWEEP', req.user._id, 'Manual expiry sweep', { ...result, released });
        res.json({ message: 'Expiry sweep complete.', ...result, staleHoldsReleased: released });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCoinConfig,
    updateCoinConfig,
    getCoinStats,
    getCoinWallets,
    getWalletHistory,
    adjustWallet,
    setWalletFreeze,
    runExpirySweep
};
