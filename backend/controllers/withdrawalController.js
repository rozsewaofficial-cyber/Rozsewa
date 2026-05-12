const Withdrawal = require('../models/Withdrawal');
const Provider = require('../models/Provider');
const { Wallet } = require('../models/Wallet');

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

        const wallet = await Wallet.findOne({ providerId: req.user._id });

        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ message: 'Insufficient balance.' });
        }

        // Create withdrawal request
        const withdrawal = await Withdrawal.create({
            providerId: req.user._id,
            amount,
            bankDetails: provider.bankDetails
        });

        // Deduct balance
        wallet.balance -= amount;
        await wallet.save();

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
        const withdrawals = await Withdrawal.find()
            .populate('providerId', 'shopName ownerName mobile')
            .sort({ createdAt: -1 });
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

        // If rejected, refund the money to wallet!
        if (status === 'rejected') {
            const wallet = await Wallet.findOne({ providerId: withdrawal.providerId });
            if (wallet) {
                wallet.balance += withdrawal.amount;
                await wallet.save();
            }
        }

        await withdrawal.save();
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
        const withdrawals = await Withdrawal.find({ providerId: req.user._id })
            .sort({ createdAt: -1 });
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
