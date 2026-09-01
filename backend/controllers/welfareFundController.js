const Provider = require('../models/Provider');
const WelfareFundContribution = require('../models/WelfareFundContribution');
const { Wallet, Transaction } = require('../models/Wallet');

// @desc    Provider/Sewak makes a voluntary contribution to the RozSewa Welfare Fund
// @route   POST /api/welfare-fund/contribute
// @access  Private (Provider/Sewak)
const contributeToWelfareFund = async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!amount || isNaN(amount) || amount < 1) {
            return res.status(400).json({ message: 'Please enter a valid contribution amount.' });
        }

        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        let wallet = await Wallet.findOne({ providerId: provider._id });
        if (!wallet) {
            wallet = await Wallet.create({ providerId: provider._id, balance: 0 });
        }

        if (wallet.balance < amount) {
            return res.status(400).json({ message: `Insufficient wallet balance. Available: ₹${wallet.balance}` });
        }

        wallet.balance -= amount;
        wallet.updatedAt = Date.now();
        await wallet.save();

        provider.walletBalance = wallet.balance;
        await provider.save();

        await Transaction.create({
            providerId: provider._id,
            title: 'RozSewa Welfare Fund Contribution',
            amount,
            type: 'debit',
            status: 'completed',
            description: 'Voluntary contribution to the RozSewa Welfare Fund'
        });

        const contribution = await WelfareFundContribution.create({
            contributorType: provider.providerCategory === 'sewak' ? 'sewak' : 'provider',
            providerId: provider._id,
            amount
        });

        res.status(201).json({
            message: 'Thank you for contributing to the RozSewa Welfare Fund!',
            contribution,
            walletBalance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get the logged-in provider/sewak's own contribution history
// @route   GET /api/welfare-fund/my-contributions
// @access  Private (Provider/Sewak)
const getMyWelfareFundContributions = async (req, res) => {
    try {
        const contributions = await WelfareFundContribution.find({ providerId: req.user._id })
            .sort({ createdAt: -1 });

        const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);

        res.json({ contributions, totalContributed });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    contributeToWelfareFund,
    getMyWelfareFundContributions
};
