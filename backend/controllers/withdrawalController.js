const mongoose = require('mongoose');
const { pageParams, paginate } = require('../utils/pagination');
const Withdrawal = require('../models/Withdrawal');
const Provider = require('../models/Provider');
const { Wallet, Transaction } = require('../models/Wallet');
const { adminRecipients } = require('../utils/adminRecipients');

// The smallest and largest payout one request may ask for, in rupees.
const MIN_WITHDRAWAL = 1;
const MAX_WITHDRAWAL = 10000000;
// An identical pending request inside this window is treated as a repeat.
const DUPLICATE_WINDOW_MS = 15 * 1000;

/**
 * A withdrawal amount from the request, or null when it isn't one: a number
 * (or a numeric string) greater than zero, in whole paise. The screen checks
 * the same, but the server cannot rely on that — a negative amount used to
 * pass every check below and *added* that sum to the wallet.
 */
const parseAmount = (raw) => {
    if (raw === null || raw === undefined || typeof raw === 'boolean' || raw === '') return null;
    const n = typeof raw === 'string' ? Number(raw.trim()) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null; // paise only
    return Math.round(n * 100) / 100;
};

/** Tell the partner's open screens the wallet moved. */
const emitWalletUpdated = (providerId, balance) => {
    try {
        const { emitToProvider } = require('../config/socket');
        emitToProvider(providerId, 'WALLET_UPDATED', { balance });
    } catch (err) {
        console.error('Failed to emit WALLET_UPDATED:', err.message);
    }
};

// @desc    Request a withdrawal
// @route   POST /api/provider/withdraw
// @access  Private (Provider)
const requestWithdrawal = async (req, res) => {
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount <= 0) {
        return res.status(400).json({ message: 'Enter a valid amount in rupees (up to 2 decimals).' });
    }
    if (amount < MIN_WITHDRAWAL) {
        return res.status(400).json({ message: `The minimum withdrawal is ₹${MIN_WITHDRAWAL}.` });
    }
    if (amount > MAX_WITHDRAWAL) {
        return res.status(400).json({ message: `A single withdrawal can be at most ₹${MAX_WITHDRAWAL.toLocaleString('en-IN')}.` });
    }

    try {
        const provider = await Provider.findById(req.user._id);

        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        if (!provider.kycVerified) {
            return res.status(400).json({ message: 'KYC verification is required for withdrawals.' });
        }

        if (!provider.bankDetails || !provider.bankDetails.accountNumber) {
            return res.status(400).json({ message: 'Please link your bank account first.' });
        }

        let wallet = await Wallet.findOne({ providerId: req.user._id });

        if (!wallet || wallet.availableBalance < amount) {
            return res.status(400).json({ message: 'Insufficient Available Balance.' });
        }

        // Category-wise payout lock: while starter-kit instalments are outstanding
        // and the wallet has gone negative, withdrawals are blocked until the
        // balance recovers. Deliberately withdrawal-only — the separate
        // cash_limits_config debt system governs app access, and locking both at
        // once would stop the Sewak earning the money that clears these dues.
        try {
            const KitDue = require('../models/KitDue');
            const hasOpenDues = await KitDue.exists({ sewakId: req.user._id, status: 'active' });
            if (hasOpenDues && wallet.balance < 0) {
                const KitPaymentConfig = require('../models/KitPaymentConfig');
                const cfg = provider.vendorType
                    ? await KitPaymentConfig.findOne({ categoryId: provider.vendorType }).lean()
                    : null;
                if (!cfg || cfg.blockPayoutOnDues !== false) {
                    return res.status(400).json({
                        message: `Your wallet balance is negative (₹${wallet.balance}) because of pending starter kit instalments. Withdrawals resume once your balance is back above zero.`
                    });
                }
            }
        } catch (err) {
            console.error('[Withdrawal] kit dues payout check failed:', err.message);
        }

        // The same request sent again within seconds (a double tap, a retry
        // after a slow network) is the same request, not a second payout.
        const justAsked = await Withdrawal.exists({
            providerId: req.user._id,
            amount,
            status: 'pending',
            createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) }
        });
        if (justAsked) {
            return res.status(409).json({ message: 'You just requested this withdrawal. Please wait a moment before asking again.' });
        }

        // Create withdrawal request
        const withdrawal = await Withdrawal.create({
            providerId: req.user._id,
            amount,
            bankDetails: provider.bankDetails
        });

        // Held in one update, matched on the money still being there. Reading
        // the balance, checking it, and writing it back afterwards let several
        // requests sent together each clear the same check and each be paid.
        //
        // Only the earnings (availableBalance) are held. `balance` is the
        // prepaid wallet / cash-commission dues, a separate figure the payout
        // has nothing to do with: taking the payout off it too lowered a
        // partner's prepaid money, or added to what they owed, with every
        // withdrawal — which could push them over the cash limit and out of
        // bookings.
        const held = await Wallet.findOneAndUpdate(
            { providerId: req.user._id, availableBalance: { $gte: amount } },
            {
                $inc: { availableBalance: -amount },
                $set: { updatedAt: Date.now() }
            },
            { new: true }
        );

        if (!held) {
            // Somebody got there first. The request was already written, so it
            // is withdrawn again rather than left pending against money that
            // is no longer available.
            await Withdrawal.deleteOne({ _id: withdrawal._id });
            return res.status(400).json({ message: 'Insufficient Available Balance.' });
        }
        wallet = held;
        emitWalletUpdated(req.user._id, wallet.balance);

        // Create a pending ledger Transaction (tied to this withdrawal, so
        // approving or rejecting it settles this row and not another's)
        const accountLastFour = String(provider.bankDetails?.accountNumber || '').slice(-4);
        await Transaction.create({
            providerId: req.user._id,
            title: 'Withdrawal Requested',
            amount: amount,
            type: 'debit',
            status: 'pending',
            withdrawalId: withdrawal._id,
            description: `Payout requested to linked bank account ending in ${accountLastFour}`
        });

        // Only now that the money is held does admin hear of it — a request
        // that was refused above must not have pinged them.
        (async () => {
            try {
                const { sendNotificationToUser } = require('../config/notificationService');

                const admins = await adminRecipients();

                for (const admin of admins) {
                    sendNotificationToUser(admin._id, 'admin', {
                        title: 'New Withdrawal Request',
                        body: `Partner ${provider.ownerName} requested a payout of ₹${amount}.`,
                        data: {
                            type: 'withdrawal',
                            id: withdrawal._id.toString(),
                            link: '/admin/finance'
                        }
                    }).catch(err => console.log('Admin push notification failed:', err.message));
                }
            } catch (err) {
                console.log('Admin push notification lookup failed:', err.message);
            }
        })();

        // Emit socket event to admins
        try {
            const { getIO } = require('../config/socket');
            const io = getIO();
            if (io) {
                io.to('admin_room').emit('NEW_WITHDRAWAL_REQUEST', {
                    id: withdrawal._id,
                    amount: withdrawal.amount,
                    providerName: provider.ownerName,
                    shopName: provider.shopName
                });
            }
        } catch (socketErr) {
            console.error('Socket emit failed for withdrawal request:', socketErr.message);
        }

        res.status(201).json({ message: 'Withdrawal request submitted successfully.', withdrawal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all withdrawals
// @route   GET /api/admin/withdrawals
// @access  Private (Admin)
const getWithdrawals = async (req, res) => {
    try {
        // No filter at all: every withdrawal request in the platform.
        const scope = req.query.status ? { status: req.query.status } : {};
        const withdrawals = await paginate(
            Withdrawal.find(scope)
                .populate('providerId', 'shopName ownerName mobile')
                .sort({ createdAt: -1 }),
            pageParams(req)
        );

        // Screens count the pending ones for a badge. Counting the page would
        // stop the badge at whatever the page happened to hold.
        res.set('X-Total-Count', String(await Withdrawal.countDocuments(scope)));
        res.set('X-Pending-Count', String(await Withdrawal.countDocuments({ status: 'pending' })));
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update withdrawal status
// @route   PATCH /api/admin/withdrawals/:id
// @access  Private (Admin)
const updateWithdrawalStatus = async (req, res) => {
    const { status, reason } = req.body || {};

    try {
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be approved or rejected.' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }

        // Claimed in one update that only matches a request still pending.
        // Checking the status and then saving let two decisions made together
        // (a double tap, two admins) both pass — and a double rejection
        // refunded the partner twice.
        const update = { status };
        if (reason) update.reason = String(reason).slice(0, 300);
        const withdrawal = await Withdrawal.findOneAndUpdate(
            { _id: req.params.id, status: 'pending' },
            { $set: update },
            { new: true }
        );

        if (!withdrawal) {
            const exists = await Withdrawal.exists({ _id: req.params.id });
            return res.status(exists ? 400 : 404).json({
                message: exists ? 'Withdrawal request already processed' : 'Withdrawal request not found'
            });
        }

        // The ledger row that was written when this was requested.
        const pendingTx = async () =>
            (await Transaction.findOne({ withdrawalId: withdrawal._id, status: 'pending' }))
            // Requests made before rows were tied to a withdrawal.
            || (await Transaction.findOne({
                providerId: withdrawal.providerId,
                amount: withdrawal.amount,
                status: 'pending',
                withdrawalId: { $exists: false }
            }).sort({ createdAt: -1 }));
        const lastFour = String(withdrawal.bankDetails?.accountNumber || '').slice(-4);

        try {
            if (status === 'approved') {
                // The money was held when it was requested; approving completes the row.
                const tx = await pendingTx();
                if (tx) {
                    tx.status = 'completed';
                    tx.title = 'Withdrawal Processed';
                    tx.description = `Payout completed to linked bank account ending in ${lastFour}`;
                    await tx.save();
                }
            } else {
                // Rejected: the held earnings go back, and the ledger row fails.
                const refunded = await Wallet.findOneAndUpdate(
                    { providerId: withdrawal.providerId },
                    { $inc: { availableBalance: withdrawal.amount }, $set: { updatedAt: Date.now() } },
                    { new: true }
                );
                if (!refunded) throw new Error('Wallet not found for refund');
                emitWalletUpdated(withdrawal.providerId, refunded.balance);

                const tx = await pendingTx();
                if (tx) {
                    tx.status = 'failed';
                    tx.title = 'Withdrawal Rejected';
                    tx.description = `Payout rejected. Reason: ${reason || 'N/A'}`;
                    await tx.save();
                }
            }
        } catch (err) {
            // Nothing is left half done: the request goes back to pending so
            // it can be decided again, rather than staying "rejected" without
            // the refund having happened.
            await Withdrawal.updateOne({ _id: withdrawal._id }, { $set: { status: 'pending' }, $unset: { reason: 1 } });
            throw err;
        }

        // Push Notification for Provider (in background)
        (async () => {
            try {
                // In-app + live + push (it was a phone push only).
                const { notifyUser } = require('../config/notificationService');
                const message = status === 'approved'
                    ? `Your withdrawal request of ₹${withdrawal.amount} has been approved.`
                    : `Your withdrawal request of ₹${withdrawal.amount} was rejected. Reason: ${reason || 'N/A'}`;

                notifyUser({
                    userId: withdrawal.providerId,
                    userRole: 'provider',
                    title: `Withdrawal ${status === 'approved' ? 'Approved' : 'Rejected'}`,
                    message,
                    type: 'payment',
                    data: {
                        type: 'withdrawal',
                        id: withdrawal._id.toString(),
                        link: '/provider/wallet'
                    }
                }).catch(err => console.log('Provider withdrawal notification failed:', err.message));
            } catch (err) {
                console.log('Push notification failed (skipping):', err.message);
            }
        })();

        // Emit status update to admin_room to sync pending counts
        try {
            const { getIO } = require('../config/socket');
            const io = getIO();
            if (io) {
                io.to('admin_room').emit('WITHDRAWAL_STATUS_UPDATED', {
                    id: withdrawal._id,
                    status: withdrawal.status
                });
            }
        } catch (socketErr) {
            console.error('Socket emit failed for withdrawal status update:', socketErr.message);
        }

        res.json({ message: `Withdrawal request ${status}`, withdrawal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get provider's withdrawals
// @route   GET /api/provider/withdrawals
// @access  Private (Provider)
const getProviderWithdrawals = async (req, res) => {
    try {
        // One partner's whole withdrawal history, which only ever grows.
        const withdrawals = await paginate(
            Withdrawal.find({ providerId: req.user._id })
                .sort({ createdAt: -1 }),
            pageParams(req)
        );
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    requestWithdrawal,
    getWithdrawals,
    updateWithdrawalStatus,
    getProviderWithdrawals,
    // exported for its check script
    parseAmount
};
