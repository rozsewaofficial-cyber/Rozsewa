const { pageParams, paginate } = require('../utils/pagination');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Provider = require('../models/Provider');
const User = require('../models/User');
const WelfareFundContribution = require('../models/WelfareFundContribution');
const { Wallet, Transaction } = require('../models/Wallet');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Who is giving, and which wallet the money comes out of.
 *
 * Customers and partners both contribute to the same fund, but their money
 * lives in differently-keyed wallets — `userId` for a customer, `providerId`
 * for a partner or Sewak. Resolved in one place so the two paths cannot drift
 * into crediting the fund from the wrong ledger.
 */
const contributorFor = async (principal) => {
    const isProvider = principal.role === 'provider' || principal.role === 'sewak';

    if (isProvider) {
        const provider = await Provider.findById(principal._id);
        if (!provider) return null;
        return {
            kind: provider.providerCategory === 'sewak' ? 'sewak' : 'provider',
            walletQuery: { providerId: provider._id },
            ledgerKey: { providerId: provider._id },
            contributionKey: { providerId: provider._id },
            provider
        };
    }

    // Everyone else signing in through the customer app.
    const user = await User.findById(principal._id);
    if (!user) return null;
    return {
        kind: 'customer',
        walletQuery: { userId: user._id },
        ledgerKey: { userId: user._id },
        contributionKey: { userId: user._id },
        user
    };
};

// @desc    Contribute to the RozSewa Welfare Fund
// @route   POST /api/welfare-fund/contribute
// @access  Private (Customer / Provider / Sewak)
const contributeToWelfareFund = async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!amount || isNaN(amount) || amount < 1) {
            return res.status(400).json({ message: 'Please enter a valid contribution amount.' });
        }

        const contributor = await contributorFor(req.user);
        if (!contributor) {
            return res.status(404).json({ message: 'Account not found' });
        }

        let wallet = await Wallet.findOne(contributor.walletQuery);
        if (!wallet) {
            wallet = await Wallet.create({ ...contributor.walletQuery, balance: 0 });
        }

        // The balance is checked and debited in a single update, matched on the
        // balance still being large enough. Reading it, deciding, and then
        // writing it back let several requests each pass the same check: five
        // sent together against a wallet of 100 all succeeded, and 500 reached
        // the fund from a wallet that never held it.
        wallet = await Wallet.findOneAndUpdate(
            { ...contributor.walletQuery, balance: { $gte: amount } },
            { $inc: { balance: -amount }, $set: { updatedAt: Date.now() } },
            { new: true }
        );

        if (!wallet) {
            const current = await Wallet.findOne(contributor.walletQuery).select('balance').lean();
            return res.status(400).json({
                message: `Insufficient wallet balance. Available: ₹${current?.balance ?? 0}`
            });
        }

        // A partner's profile carries a copy of the balance for their dashboard.
        if (contributor.provider) {
            contributor.provider.walletBalance = wallet.balance;
            await contributor.provider.save();
        }

        await Transaction.create({
            ...contributor.ledgerKey,
            title: 'RozSewa Welfare Fund Contribution',
            amount,
            type: 'debit',
            status: 'completed',
            description: 'Voluntary contribution to the RozSewa Welfare Fund'
        });

        const contribution = await WelfareFundContribution.create({
            contributorType: contributor.kind,
            ...contributor.contributionKey,
            amount,
            note: String(req.body.note || '').slice(0, 280)
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

// @desc    Create a Razorpay order for a direct (non-wallet) contribution —
//          for a customer/partner with nothing in their wallet, or who'd
//          simply rather pay by card/UPI than draw it down.
// @route   POST /api/welfare-fund/order
// @access  Private (Customer / Provider / Sewak)
const createWelfareFundOrder = async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        if (!amount || isNaN(amount) || amount < 1) {
            return res.status(400).json({ message: 'Please enter a valid contribution amount.' });
        }

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `welfare_${Date.now()}`
        });

        res.json(order);
    } catch (error) {
        console.error('Welfare Fund order creation failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify a direct Razorpay contribution and log it — no wallet is
//          touched, since the money never passed through one.
// @route   POST /api/welfare-fund/verify
// @access  Private (Customer / Provider / Sewak)
const verifyWelfareFundPayment = async (req, res) => {
    try {
        const { amount, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const contributionAmount = Number(amount);

        if (!contributionAmount || contributionAmount < 1 || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing required fields for payment verification.' });
        }

        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest('hex');
        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ message: 'Payment verification failed — signature mismatch.' });
        }

        const contributor = await contributorFor(req.user);
        if (!contributor) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const contribution = await WelfareFundContribution.create({
            contributorType: contributor.kind,
            ...contributor.contributionKey,
            amount: contributionAmount,
            note: String(req.body.note || '').slice(0, 280),
            paymentMethod: 'razorpay',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id
        });

        res.status(201).json({
            message: 'Thank you for contributing to the RozSewa Welfare Fund!',
            contribution
        });
    } catch (error) {
        console.error('Welfare Fund payment verification failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    The caller's own contribution history
// @route   GET /api/welfare-fund/my-contributions
// @access  Private (Customer / Provider / Sewak)
const getMyWelfareFundContributions = async (req, res) => {
    try {
        const contributor = await contributorFor(req.user);
        if (!contributor) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const scope = contributor.contributionKey;

        // A giving history grows without limit, so it arrives a page at a time.
        const contributions = await paginate(
            WelfareFundContribution.find(scope).sort({ createdAt: -1 }),
            pageParams(req)
        );

        // Totalled over everything they have ever given, not over the page.
        // Summing the rows in hand would tell a long-standing contributor they
        // had given only what the most recent page happens to show.
        const [totals] = await WelfareFundContribution.aggregate([
            { $match: scope },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);

        res.json({
            contributions,
            totalContributed: Math.round((totals?.total || 0) * 100) / 100,
            contributionsCount: totals?.count || 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    What the fund has received in total, for the public-facing card
// @route   GET /api/welfare-fund/summary
// @access  Private (Customer / Provider / Sewak)
// Counted in the database: this describes every contribution ever made, which
// no page of them could.
const getWelfareFundSummary = async (req, res) => {
    try {
        const [row] = await WelfareFundContribution.aggregate([
            {
                $group: {
                    _id: null,
                    totalRaised: { $sum: '$amount' },
                    contributions: { $sum: 1 },
                    fromCustomers: { $sum: { $cond: [{ $eq: ['$contributorType', 'customer'] }, '$amount', 0] } },
                    fromPartners: { $sum: { $cond: [{ $in: ['$contributorType', ['provider', 'sewak']] }, '$amount', 0] } }
                }
            }
        ]);

        // How many distinct people have given, rather than how many gifts.
        const [people] = await WelfareFundContribution.aggregate([
            { $group: { _id: { $ifNull: ['$userId', '$providerId'] } } },
            { $count: 'contributors' }
        ]);

        res.json({
            totalRaised: Math.round((row?.totalRaised || 0) * 100) / 100,
            contributions: row?.contributions || 0,
            contributors: people?.contributors || 0,
            fromCustomers: Math.round((row?.fromCustomers || 0) * 100) / 100,
            fromPartners: Math.round((row?.fromPartners || 0) * 100) / 100
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    contributeToWelfareFund,
    createWelfareFundOrder,
    verifyWelfareFundPayment,
    getMyWelfareFundContributions,
    getWelfareFundSummary
};
