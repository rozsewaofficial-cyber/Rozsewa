const { pageParams, paginate } = require('../utils/pagination');
const { Wallet, Transaction } = require('../models/Wallet');

// @desc    Get wallet and transactions (Customer or Provider)
// @route   GET /api/wallet
// @access  Private
const getWallet = async (req, res) => {
    try {
        const query = req.user.role === 'provider' ? { providerId: req.user._id } : { userId: req.user._id };

        let wallet = await Wallet.findOne(query);
        // A wallet statement grows for the life of the account, so the
        // screen gets the recent page rather than the whole ledger.
        const transactions = await paginate(
            Transaction.find(query).sort({ createdAt: -1 }),
            pageParams(req)
        );

        // Earned and spent are lifetime figures, so they are totalled over the
        // whole statement rather than by the screen over the page it holds.
        const [totals] = await Transaction.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalEarned: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, { $abs: '$amount' }, 0] } },
                    totalSpent: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, { $abs: '$amount' }, 0] } }
                }
            }
        ]);

        res.json({
            balance: wallet ? wallet.balance : 0,
            availableBalance: wallet ? wallet.availableBalance : 0,
            transactions: transactions,
            // How many there are in total, so a statement showing one page can
            // page through the rest instead of stopping at what it was handed.
            transactionsTotal: await Transaction.countDocuments(query),
            totalEarned: Math.round((totals?.totalEarned || 0) * 100) / 100,
            totalSpent: Math.round((totals?.totalSpent || 0) * 100) / 100
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
