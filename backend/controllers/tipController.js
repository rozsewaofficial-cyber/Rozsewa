const { pageParams, paginate } = require('../utils/pagination');
const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const Tip = require('../models/Tip');
const { Wallet, Transaction } = require('../models/Wallet');

const MAX_TIP = 10000;

/** Resolves who actually did the job, per the three cases in the Tip Module spec. */
const resolveProfessional = (booking, provider) => {
    if (booking.staffId) {
        return { professionalType: 'staff', staffId: booking.staffId };
    }
    return { professionalType: provider.providerCategory === 'sewak' ? 'sewak' : 'partner', staffId: null };
};

// @desc    Create a Razorpay order for a customer tip (always its own order —
//          independent of however the booking itself is being/was paid)
// @route   POST /api/tips/order
// @access  Private (Customer)
const createTipOrder = async (req, res) => {
    try {
        const { bookingId, amount } = req.body;
        const tipAmount = Number(amount);
        if (!bookingId || !tipAmount || isNaN(tipAmount) || tipAmount < 1) {
            return res.status(400).json({ message: 'A valid bookingId and amount are required.' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }
        if (booking.status !== 'completed') {
            return res.status(400).json({ message: 'You can only tip once the service is completed.' });
        }

        if (!Number.isInteger(tipAmount) || tipAmount > MAX_TIP) {
            return res.status(400).json({ message: `Tip must be a whole amount up to ₹${MAX_TIP}.` });
        }

        // Recorded, so verifying it credits exactly what was paid, once.
        const { createRecordedOrder } = require('./paymentController');
        const order = await createRecordedOrder({
            amount: tipAmount, purpose: 'tip', userId: req.user._id,
            meta: { bookingId: String(booking._id), tipAmount }
        });

        res.json({ ...order, key: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error('Tip order creation failed:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify a tip payment and credit the executing party's wallet — 100%,
//          no commission or platform deduction of any kind.
// @route   POST /api/tips/verify
// @access  Private (Customer)
const verifyTip = async (req, res) => {
    try {
        const { bookingId, triggerPoint, razorpay_order_id, razorpay_payment_id } = req.body;
        if (!['payment_screen', 'post_payment'].includes(triggerPoint)) {
            return res.status(400).json({ message: 'Invalid triggerPoint' });
        }

        // The signature checked and the recorded tip order claimed once. The
        // amount used to come from the request (pay ₹1, credit any sum) and
        // the same payment could be verified again and again.
        const { claimPayment } = require('./paymentController');
        const claim = await claimPayment(req, { purpose: 'tip', principal: req.user._id });
        if (claim.error) return res.status(claim.status).json({ message: claim.error });
        const tipAmount = Number(claim.order.amount);
        const tipBookingId = claim.order.meta?.bookingId;
        if (bookingId && tipBookingId && String(bookingId) !== String(tipBookingId)) {
            return res.status(400).json({ message: 'This tip was paid for another booking.' });
        }

        const booking = await Booking.findById(tipBookingId || bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        const tip = await creditTip({
            booking, amount: tipAmount, customerId: req.user._id,
            orderId: razorpay_order_id, paymentId: razorpay_payment_id, triggerPoint
        });
        res.status(201).json({ message: 'Thank you for your tip!', tip });
    } catch (error) {
        console.error('Tip verification failed:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Credits a paid tip to the professional — 100%, no commission — and keeps
 * a Tip record. Used by the tip's own payment and by a tip paid with the bill.
 */
const creditTip = async ({ booking, amount, customerId, orderId, paymentId, triggerPoint }) => {
    const tipAmount = Number(amount);
    {
        const provider = await Provider.findById(booking.providerId);
        if (!provider) throw new Error('Provider not found for this booking');

        const { professionalType, staffId } = resolveProfessional(booking, provider);

        // Tip always lands in the Provider's own wallet — there is no separate
        // staff-level wallet in the system. When professionalType is 'staff',
        // staffId is preserved on the Tip record so the Partner knows who it's for.
        let wallet = await Wallet.findOne({ providerId: provider._id });
        if (!wallet) {
            wallet = await Wallet.create({ providerId: provider._id, balance: 0 });
        }
        wallet.availableBalance = (wallet.availableBalance || 0) + tipAmount;
        wallet.updatedAt = Date.now();
        await wallet.save();

        provider.walletBalance = wallet.balance;
        await provider.save();

        const tipTitle = staffId ? 'Customer Tip (for staff-completed job)' : 'Customer Tip';
        await Transaction.create({
            providerId: provider._id,
            title: tipTitle,
            amount: tipAmount,
            type: 'credit',
            status: 'completed',
            bookingId: booking._id,
            description: `100% customer tip for ${booking.serviceName} — no commission deducted.`
        });

        const tip = await Tip.create({
            bookingId: booking._id,
            customerId,
            providerId: provider._id,
            staffId,
            professionalType,
            amount: tipAmount,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            status: 'credited',
            paymentMode: 'online',
            triggerPoint
        });

        try {
            const { notifyUser } = require('../config/notificationService');
            await notifyUser({
                userId: provider._id,
                userRole: 'provider',
                title: 'You received a Tip! 💗',
                message: `A customer tipped you ₹${tipAmount} for ${booking.serviceName}. 100% credited to your wallet.`,
                type: 'payment',
                bookingId: booking._id
            });
        } catch (notifyErr) {
            console.error('Tip notification failed:', notifyErr.message);
        }

        return tip;
    }
};

// @desc    A tip paid in cash with the bill: recorded for the professional
//          and the customer, nothing credited (the platform never had it).
// @route   POST /api/tips/cash
// @access  Private (Customer)
const recordCashTip = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const tipAmount = Number(req.body.amount);
        // 0: the customer took the cash tip back ("No tip") before paying.
        if (bookingId && tipAmount === 0) {
            const b = await Booking.findById(bookingId);
            if (!b) return res.status(404).json({ message: 'Booking not found' });
            if (b.userId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized for this booking' });
            if (b.paymentStatus === 'paid') return res.status(400).json({ message: 'This bill is already paid.' });
            await Tip.deleteMany({ bookingId: b._id, status: 'cash' });
            await Booking.updateOne({ _id: b._id }, { $set: { cashTip: 0 } });
            return res.json({ message: 'Cash tip removed.' });
        }
        if (!bookingId || !Number.isInteger(tipAmount) || tipAmount < 1 || tipAmount > MAX_TIP) {
            return res.status(400).json({ message: `A tip between ₹1 and ₹${MAX_TIP} is required.` });
        }
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }
        if (booking.status !== 'completed') {
            return res.status(400).json({ message: 'You can only tip once the service is completed.' });
        }
        // One cash tip with the bill per booking: a second tap changes it.
        const provider = await Provider.findById(booking.providerId);
        if (!provider) return res.status(404).json({ message: 'Provider not found for this booking' });
        const { professionalType, staffId } = resolveProfessional(booking, provider);
        const tip = await Tip.findOneAndUpdate(
            { bookingId: booking._id, status: 'cash' },
            {
                $set: { amount: tipAmount },
                $setOnInsert: {
                    bookingId: booking._id, customerId: req.user._id, providerId: provider._id, staffId,
                    professionalType, status: 'cash', paymentMode: 'cash', triggerPoint: 'payment_screen'
                }
            },
            { upsert: true, new: true }
        );
        await Booking.updateOne({ _id: booking._id }, { $set: { cashTip: tipAmount } });
        try {
            const { notifyUser } = require('../config/notificationService');
            await notifyUser({
                userId: provider._id, userRole: 'provider',
                title: 'Tip in cash 💗',
                message: `The customer is giving you a ₹${tipAmount} tip in cash with the bill for ${booking.serviceName}.`,
                type: 'payment', bookingId: booking._id
            });
        } catch (notifyErr) {
            console.error('Tip notification failed:', notifyErr.message);
        }
        res.status(201).json({ message: 'Cash tip noted.', tip });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all credited tips for a booking (drives the "already tipped" UI)
// @route   GET /api/tips/booking/:bookingId
// @access  Private (Customer or the Provider on the booking)
const getTipsForBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId).select('userId providerId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        const isCustomer = booking.userId.toString() === req.user._id.toString();
        const isProvider = booking.providerId && booking.providerId.toString() === req.user._id.toString();
        if (!isCustomer && !isProvider) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        // Tips on one booking: few in practice, capped all the same.
        // Online tips credited, and tips paid in cash with the bill.
        const tipScope = { bookingId: new (require('mongoose').Types.ObjectId)(String(req.params.bookingId)), status: { $in: ['credited', 'cash'] } };
        const tips = await paginate(
            Tip.find(tipScope).sort({ createdAt: -1 }),
            pageParams(req)
        );

        // Totalled over every tip on the booking, not over the page of them:
        // this figure is what the worker was actually given.
        const byStatus = await Tip.aggregate([
            { $match: tipScope },
            { $group: { _id: '$status', total: { $sum: '$amount' } } }
        ]);
        const onlineTipped = byStatus.find(t => t._id === 'credited')?.total || 0;
        const cashTipped = byStatus.find(t => t._id === 'cash')?.total || 0;
        const totalTipped = onlineTipped + cashTipped;

        res.json({ tips, totalTipped, onlineTipped, cashTipped });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTipOrder,
    verifyTip,
    getTipsForBooking,
    recordCashTip,
    creditTip
};
