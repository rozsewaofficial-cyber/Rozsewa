const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const Tip = require('../models/Tip');
const { Wallet, Transaction } = require('../models/Wallet');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

        const order = await razorpay.orders.create({
            amount: Math.round(tipAmount * 100),
            currency: 'INR',
            receipt: `tip_${Date.now()}`
        });

        res.json(order);
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
        const { bookingId, amount, triggerPoint, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const tipAmount = Number(amount);

        if (!bookingId || !tipAmount || tipAmount < 1 || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing required fields for tip verification.' });
        }
        if (!['payment_screen', 'post_payment'].includes(triggerPoint)) {
            return res.status(400).json({ message: 'Invalid triggerPoint' });
        }

        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest('hex');
        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ message: 'Payment verification failed — signature mismatch.' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this booking' });
        }

        const provider = await Provider.findById(booking.providerId);
        if (!provider) return res.status(404).json({ message: 'Provider not found for this booking' });

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
            customerId: req.user._id,
            providerId: provider._id,
            staffId,
            professionalType,
            amount: tipAmount,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            status: 'credited',
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

        res.status(201).json({ message: 'Thank you for your tip!', tip });
    } catch (error) {
        console.error('Tip verification failed:', error);
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

        const tips = await Tip.find({ bookingId: req.params.bookingId, status: 'credited' }).sort({ createdAt: -1 });
        const totalTipped = tips.reduce((sum, t) => sum + t.amount, 0);

        res.json({ tips, totalTipped });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTipOrder,
    verifyTip,
    getTipsForBooking
};
