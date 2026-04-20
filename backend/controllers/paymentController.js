const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// @desc    Create Razorpay Order
// @route   POST /api/payment/order
// @access  Public (for registration) / Private (for bookings)
const createOrder = async (req, res) => {
    const { amount, currency } = req.body;

    try {
        const options = {
            amount: amount * 100, // amount in smallest currency unit (paise)
            currency: currency || "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify Razorpay Payment
// @route   POST /api/payment/verify
// @access  Public / Private
const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        // If bookingId is provided, update the booking status
        if (bookingId) {
            const Booking = require('../models/Booking');
            await Booking.findByIdAndUpdate(bookingId, { paymentStatus: 'paid' });
        }
        res.json({ message: "Payment verified successfully", success: true });
    } else {
        res.status(400).json({ message: "Invalid signature", success: false });
    }
};

// @desc    Verify Razorpay Payment for Subscription
// @route   POST /api/payment/verify-subscription
// @access  Private (Provider)
const verifySubscriptionPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        const Provider = require('../models/Provider');
        const SubscriptionPlan = require('../models/SubscriptionPlan');

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) return res.status(404).json({ message: "Subscription plan not found" });

        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        // Update provider subscription status
        provider.isSubscribed = true;
        provider.subscriptionExpiry = new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000);
        provider.subscriptionRate = plan.offeredCommissionRate;
        provider.subscriptionType = plan.offeredCommissionType;

        await provider.save();

        res.json({ message: "Elite Subscription activated successfully!", success: true });
    } else {
        res.status(400).json({ message: "Invalid payment signature", success: false });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    verifySubscriptionPayment
};
