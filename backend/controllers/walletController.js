const { Wallet, Transaction } = require('../models/Wallet');

// @desc    Get wallet and transactions (Customer or Provider)
// @route   GET /api/wallet
// @access  Private
const getWallet = async (req, res) => {
    try {
        const query = req.user.role === 'provider' ? { providerId: req.user._id } : { userId: req.user._id };

        let wallet = await Wallet.findOne(query);
        const transactions = await Transaction.find(query).sort({ createdAt: -1 });

        res.json({
            balance: wallet ? wallet.balance : 0,
            availableBalance: wallet ? wallet.availableBalance : 0,
            transactions: transactions,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add money / Credit to wallet
// @route   POST /api/wallet/add
// @access  Private
const addMoney = async (req, res) => {
    const { amount, title, type = 'credit' } = req.body;

    try {
        const query = req.user.role === 'provider' ? { providerId: req.user._id } : { userId: req.user._id };
        let wallet = await Wallet.findOne(query);

        if (!wallet) {
            wallet = await Wallet.create({ ...query, balance: 0 });
        }

        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }

        if (type === 'credit') {
            wallet.balance += amt;
        } else {
            wallet.balance -= amt;
        }

        wallet.updatedAt = Date.now();
        await wallet.save();

        const transaction = await Transaction.create({
            ...query,
            title: title || (type === 'credit' ? 'Money Added' : 'Money Debited'),
            amount: amt,
            type: type,
            status: 'completed',
        });

        // Notify User/Provider
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: req.user._id,
            userRole: req.user.role || 'user',
            title: 'Wallet Update',
            message: `₹${amt} has been ${type === 'credit' ? 'credited to' : 'debited from'} your wallet.`,
            type: 'payment'
        });

        res.json({
            balance: wallet.balance,
            transaction: transaction,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getWallet,
    addMoney,
};
