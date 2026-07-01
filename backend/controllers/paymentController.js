const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');

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
            amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
            currency: currency || "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ message: error.message, details: error });
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
            const booking = await Booking.findById(bookingId);
            if (booking) {
                booking.paymentStatus = 'paid';
                await booking.save();

                const { notifyUser } = require('../config/notificationService');
                await notifyUser({
                    userId: booking.userId,
                    userRole: 'user',
                    title: 'Payment Successful',
                    message: `Payment of ₹${booking.totalAmount} for ${booking.serviceName} was successful.`,
                    type: 'payment',
                    bookingId: booking._id
                });

                if (booking.providerId) {
                    try {
                        await notifyUser({
                            userId: booking.providerId,
                            userRole: 'provider',
                            title: 'Payment Received',
                            message: `Payment of ₹${booking.totalAmount} for ${booking.serviceName} has been received.`,
                            type: 'payment',
                            bookingId: booking._id
                        });
                    } catch (notiErr) {
                        console.error('[Notification Trigger Error] Failed to send payment received notification to provider:', notiErr);
                    }
                }
            }
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

        const ProviderSubscription = require('../models/ProviderSubscription');

        // Deactivate existing active subscriptions
        await ProviderSubscription.updateMany(
            { provider: provider._id, status: 'active' },
            { status: 'expired' }
        );

        // Calculate expiry based on duration in days
        const purchaseDate = new Date();
        const expiryDate = new Date();
        const durationDays = plan.duration || (plan.planType === 'monthly' ? 30 : 365);
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        // Create new provider subscription record
        await ProviderSubscription.create({
            provider: provider._id,
            subscription: plan._id,
            startDate: purchaseDate,
            endDate: expiryDate,
            pricePaid: plan.price,
            status: 'active'
        });

        // Update provider subscription status (for legacy compatibility)
        provider.isSubscribed = true;
        provider.subscriptionPurchaseDate = purchaseDate;
        provider.subscriptionExpiry = expiryDate;
        provider.subscriptionPrice = plan.price;
        provider.subscriptionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;
        provider.subscriptionType = plan.offeredCommissionType || 'percentage';
        provider.planType = plan.name.toLowerCase().includes('elite') ? 'Elite' : 'Pro';

        // Update the actual commission rate used for bookings (legacy)
        provider.commissionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;

        await provider.save();

        res.json({ message: "Elite Subscription activated successfully!", success: true });
    } else {
        res.status(400).json({ message: "Invalid payment signature", success: false });
    }
};

// @desc    Verify Razorpay Payment for Wallet Recharge / Debt Settlement
// @route   POST /api/payment/verify-wallet
// @access  Private (Provider)
const verifyWalletRecharge = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        const { Wallet, Transaction } = require('../models/Wallet');
        const Provider = require('../models/Provider');

        let wallet = await Wallet.findOne({ providerId: req.user._id });
        if (!wallet) {
            wallet = await Wallet.create({ providerId: req.user._id, balance: 0 });
        }

        const rechargeAmount = Number(amount);
        wallet.balance += rechargeAmount;
        wallet.cashCommissionDues = Math.max(0, wallet.cashCommissionDues - rechargeAmount);
        await wallet.save();

        await Transaction.create({
            providerId: req.user._id,
            title: 'Debt Settlement',
            amount: rechargeAmount,
            type: 'credit',
            status: 'completed',
            description: `Paid admin via Razorpay (ID: ${razorpay_payment_id})`
        });

        // Update provider wallet reference
        const provider = await Provider.findById(req.user._id);
        if (provider) {
            provider.walletBalance = wallet.balance;
            await provider.save();
        }

        res.json({ message: "Debt settled successfully!", success: true });
    } else {
        res.status(400).json({ message: "Invalid payment signature", success: false });
    }
};

// @desc    Verify Razorpay Payment for User Wallet Recharge
// @route   POST /api/payment/verify-user-wallet
// @access  Private (User)
const verifyUserWalletRecharge = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        const { Wallet, Transaction } = require('../models/Wallet');

        let wallet = await Wallet.findOne({ userId: req.user._id });
        if (!wallet) {
            wallet = await Wallet.create({ userId: req.user._id, balance: 0 });
        }

        const rechargeAmount = Number(amount);
        wallet.balance += rechargeAmount;
        await wallet.save();

        await Transaction.create({
            userId: req.user._id,
            title: 'Added Money to Wallet',
            amount: rechargeAmount,
            type: 'credit',
            status: 'completed',
            description: `Recharge via Razorpay (ID: ${razorpay_payment_id})`
        });

        res.json({ message: "Money added successfully!", success: true });
    } else {
        res.status(400).json({ message: "Invalid payment signature", success: false });
    }
};

// @desc    Check for expiring subscriptions and notify providers
// This function should be called by a cron job daily!
const checkExpiringSubscriptions = async () => {
    try {
        const Provider = require('../models/Provider');
        const { sendNotificationToUser } = require('../config/notificationService');

        const today = new Date();
        const twoDaysLater = new Date();
        twoDaysLater.setDate(today.getDate() + 2);

        // Find providers whose subscription expires in exactly 2 days
        const providers = await Provider.find({
            isSubscribed: true,
            subscriptionExpiry: {
                $gte: today,
                $lte: twoDaysLater
            }
        });

        for (const provider of providers) {
            await sendNotificationToUser(provider._id, 'provider', {
                title: 'Plan Expiring Soon!',
                body: 'Your plan expires in 2 days. Please renew now.',
                data: {
                    type: 'plan',
                    id: provider._id.toString(),
                    link: '/provider/99card'
                }
            });
        }

        console.log(`Checked expiring subscriptions. Notified ${providers.length} providers.`);
    } catch (error) {
        console.error('Error checking expiring subscriptions:', error.message);
    }
};

// @desc    Verify Razorpay Payment for direct lead unlock
// @route   POST /api/payment/verify-lead-payment
// @access  Private (Provider)
const verifyLeadPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, leadId } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            
            const Lead = require('../models/Lead');
            const LeadUnlockTransaction = require('../models/LeadUnlockTransaction');

            const lead = await Lead.findById(leadId).session(session);
            if (!lead) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ message: "Lead not found" });
            }

            if (lead.unlockedProviders.includes(req.user._id)) {
                await session.abortTransaction();
                session.endSession();
                return res.json({ success: true, message: "Lead already unlocked" });
            }

            lead.unlockedProviders.push(req.user._id);
            lead.status = lead.unlockedProviders.length >= lead.maxUnlockLimit ? 'closed' : 'unlocked';
            await lead.save({ session });

            await LeadUnlockTransaction.create([{
                provider: req.user._id,
                lead: lead._id,
                unlockAmount: lead.leadPrice,
                paymentGateway: 'Razorpay',
                status: 'success'
            }], { session });

            await session.commitTransaction();
            session.endSession();

            res.json({ message: "Payment verified and lead unlocked successfully", success: true });
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            res.status(500).json({ message: err.message });
        }
    } else {
        res.status(400).json({ message: "Invalid signature", success: false });
    }
};

module.exports = {
    createOrder,
    verifyPayment,
    verifySubscriptionPayment,
    verifyWalletRecharge,
    verifyUserWalletRecharge,
    verifyLeadPayment,
    checkExpiringSubscriptions
};

// @desc    Verify Razorpay Payment for Bazaar Commission (Unlock Contact)
// @route   POST /api/payment/verify-bazaar
// @access  Private (User)
const verifyBazaarPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, offerId } = req.body;

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest('hex');

    if (razorpay_signature === expectedSign) {
        const BazaarOffer = require('../models/BazaarOffer');
        const offer = await BazaarOffer.findById(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        // We assume the buyer paid this. Set isLeadUnlockedByBuyer to true.
        offer.isLeadUnlockedByBuyer = true;
        await offer.save();

        res.json({ success: true, message: 'Payment verified! Contact details unlocked.' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
};

module.exports.verifyBazaarPayment = verifyBazaarPayment;

