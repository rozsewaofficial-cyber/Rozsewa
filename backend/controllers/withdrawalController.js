const { pageParams, paginate } = require('../utils/pagination');
const Withdrawal = require('../models/Withdrawal');
const Provider = require('../models/Provider');
const { Wallet, Transaction } = require('../models/Wallet');
const { adminRecipients } = require('../utils/adminRecipients');

// @desc    Request a withdrawal
// @route   POST /api/provider/withdraw
// @access  Private (Provider)
const requestWithdrawal = async (req, res) => {
    const { amount } = req.body;

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

        // Create withdrawal request
        const withdrawal = await Withdrawal.create({
            providerId: req.user._id,
            amount,
            bankDetails: provider.bankDetails
        });

        // Push Notification for Admins (in background)
        const accountLastFour = String(provider.bankDetails?.accountNumber || '').slice(-4);
        (async () => {
            try {
                const User = require('../models/User');
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

        // Held in one update, matched on the money still being there. Reading
        // the balance, checking it, and writing it back afterwards let several
        // requests sent together each clear the same check and each be paid.
        const held = await Wallet.findOneAndUpdate(
            { providerId: req.user._id, availableBalance: { $gte: amount } },
            {
                $inc: { availableBalance: -amount, balance: -amount },
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

        // Create a pending ledger Transaction
        await Transaction.create({
            providerId: req.user._id,
            title: 'Withdrawal Requested',
            amount: amount,
            type: 'debit',
            status: 'pending',
            description: `Payout requested to linked bank account ending in ${accountLastFour}`
        });

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
    const { status, reason } = req.body;

    try {
        const withdrawal = await Withdrawal.findById(req.params.id);

        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal request not found' });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: 'Withdrawal request already processed' });
        }

        withdrawal.status = status;
        if (reason) withdrawal.reason = reason;

        // If approved, complete the corresponding ledger transaction
        if (status === 'approved') {
            const tx = await Transaction.findOne({ providerId: withdrawal.providerId, amount: withdrawal.amount, status: 'pending' }).sort({ createdAt: -1 });
            if (tx) {
                tx.status = 'completed';
                tx.title = 'Withdrawal Processed';
                tx.description = `Payout completed to linked bank account ending in ${withdrawal.bankDetails.accountNumber.slice(-4)}`;
                await tx.save();
            }
        }

        // If rejected, refund the money to availableBalance and balance, and fail the ledger transaction
        if (status === 'rejected') {
            const wallet = await Wallet.findOne({ providerId: withdrawal.providerId });
            if (wallet) {
                wallet.availableBalance += withdrawal.amount;
                wallet.balance += withdrawal.amount;
                wallet.updatedAt = Date.now();
                await wallet.save();
            }

            const tx = await Transaction.findOne({ providerId: withdrawal.providerId, amount: withdrawal.amount, status: 'pending' }).sort({ createdAt: -1 });
            if (tx) {
                tx.status = 'failed';
                tx.title = 'Withdrawal Rejected';
                tx.description = `Payout rejected. Reason: ${reason || 'N/A'}`;
                await tx.save();
            }
        }

        await withdrawal.save();

        // Push Notification for Provider (in background)
        if (status === 'approved' || status === 'rejected') {
            (async () => {
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');
                    const message = status === 'approved' 
                        ? `Your withdrawal request of ₹${withdrawal.amount} has been approved.`
                        : `Your withdrawal request of ₹${withdrawal.amount} was rejected. Reason: ${reason || 'N/A'}`;
                    
                    sendNotificationToUser(withdrawal.providerId, 'provider', {
                        title: `Withdrawal ${status === 'approved' ? 'Approved' : 'Rejected'}`,
                        body: message,
                        data: {
                            type: 'withdrawal',
                            id: withdrawal._id.toString(),
                            link: '/provider/wallet'
                        }
                    }).catch(err => console.log('Provider push notification failed:', err.message));
                } catch (err) {
                    console.log('Push notification failed (skipping):', err.message);
                }
            })();
        }

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
    getProviderWithdrawals
};
