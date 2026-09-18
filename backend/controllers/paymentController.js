const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PaymentOrder = require('../models/PaymentOrder');

const PURPOSES = ['booking', 'wallet', 'subscription', 'lead', 'bazaar', 'kit', 'registration', 'other'];

/**
 * Accepting a payment without a gateway.
 *
 * Only ever true when the environment says so, which no production
 * environment should. It used to be switched on by the request itself, which
 * meant anyone could ask for a subscription or a kit and be given it.
 */
const SIMULATED_PAYMENTS_ALLOWED = process.env.ALLOW_SIMULATED_PAYMENTS === 'true';

/**
 * Is this signature genuinely Razorpay's?
 *
 * There is no fallback key. Signing with a default when the secret is missing
 * would mean checking every signature against a string that is published in
 * this file, so an absent secret fails every payment rather than passing them
 * all.
 */
const signatureIsValid = (orderId, paymentId, signature) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        console.error('RAZORPAY_KEY_SECRET is not set — refusing to verify any payment.');
        return false;
    }
    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    // Both are hex digests of the same length; compared without leaking where
    // they first differ.
    const a = Buffer.from(String(signature || ''), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Turn a claimed payment into the order it actually paid for.
 *
 * Checks the signature, then claims the recorded order in one atomic update so
 * the same payment cannot be presented twice. Everything the caller is then
 * trusted with — how much, what for, whose — comes off that record and not off
 * the request.
 *
 * Returns { error, status } on refusal, or { order } on success.
 */
const claimPayment = async (req, { purpose, principal } = {}) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return { status: 400, error: 'Payment details are incomplete' };
    }
    if (!signatureIsValid(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
        return { status: 400, error: 'Invalid payment signature' };
    }

    const order = await PaymentOrder.consume(razorpay_order_id, razorpay_payment_id);
    if (!order) {
        // Either this order was never recorded, or its payment was already
        // spent. Both mean the same thing here: it buys nothing now.
        return { status: 409, error: 'This payment has already been used, or the order is unknown.' };
    }

    if (purpose && order.purpose !== purpose) {
        return { status: 400, error: 'This payment was made for something else.' };
    }

    // An order created while signed in belongs to that account and nobody else.
    if (principal && (order.userId || order.providerId)) {
        const owner = (order.userId || order.providerId).toString();
        if (owner !== principal.toString()) {
            return { status: 403, error: 'This payment belongs to another account.' };
        }
    }

    return { order };
};

// @desc    Create Razorpay Order
// @route   POST /api/payment/order
// @access  Public (for registration) / Private (for bookings)
const createOrder = async (req, res) => {
    const { currency, purpose, bookingId } = req.body;

    try {
        // What the payment is worth is settled here and written down, because
        // the signature Razorpay returns later says nothing about the amount.
        // For a booking the figure comes off the booking itself, so the caller
        // cannot name their own price for work already quoted.
        let amount = Number(req.body.amount);
        let booking = null;

        if (bookingId) {
            const Booking = require('../models/Booking');
            booking = await Booking.findById(bookingId).select('totalAmount userId');
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            amount = Number(booking.totalAmount);
        }

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'A valid amount is required' });
        }

        const options = {
            amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
            currency: currency || "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        await PaymentOrder.create({
            orderId: order.id,
            amount,
            currency: options.currency,
            purpose: PURPOSES.includes(purpose) ? purpose : (bookingId ? 'booking' : 'other'),
            bookingId: booking?._id,
            // `protect` does not run on this route — registration pays before
            // there is an account — so this is recorded only when known.
            userId: req.user?.role === 'customer' ? req.user._id : undefined,
            providerId: (req.user?.role === 'provider' || req.user?.role === 'sewak') ? req.user._id : undefined
        });

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
    const { razorpay_payment_id, bookingId } = req.body;

    const claim = await claimPayment(req);
    if (claim.error) {
        return res.status(claim.status).json({ message: claim.error, success: false });
    }

    {
        // A booking is marked paid only by the payment raised for that booking.
        // Without this, one captured signature settled any booking in the
        // system, as many times as it was sent.
        if (bookingId) {
            const Booking = require('../models/Booking');
            const PaymentAudit = require('../models/PaymentAudit');
            if (!claim.order.bookingId || claim.order.bookingId.toString() !== bookingId.toString()) {
                return res.status(400).json({
                    message: 'This payment was not raised for that booking.', success: false
                });
            }
            const booking = await Booking.findById(bookingId);
            if (booking) {
                const prevPaymentStatus = booking.paymentStatus;
                const prevCollectionStatus = booking.collectionStatus;

                booking.paymentStatus = 'paid';
                booking.collectionStatus = 'online_verified';
                booking.paymentCollectedBy = 'razorpay_auto';
                booking.paymentCollectedAt = new Date();
                await booking.save();

                // Immutable audit record — Razorpay webhook is the sole authority for online payments
                await PaymentAudit.create({
                    bookingId: booking._id,
                    action: 'online_verified',
                    amount: booking.totalAmount,
                    paymentMethod: 'razorpay',
                    previousPaymentStatus: prevPaymentStatus,
                    newPaymentStatus: 'paid',
                    previousCollectionStatus: prevCollectionStatus,
                    newCollectionStatus: 'online_verified',
                    note: `Razorpay payment verified. Payment ID: ${razorpay_payment_id}`
                });

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
                        const { emitToProvider, emitToUser } = require('../config/socket');
                        emitToProvider(booking.providerId, 'PAYMENT_COMPLETED', { bookingId: booking._id });
                        emitToUser(booking.userId, 'PAYMENT_COMPLETED', { bookingId: booking._id });
                        
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
    }
};

// @desc    Verify Razorpay Payment for Subscription
// @route   POST /api/payment/verify-subscription
// @access  Private (Provider)
const verifySubscriptionPayment = async (req, res) => {
    try {
        const { planId, isSimulated } = req.body;

        let isVerified = false;
        if (isSimulated || req.body.razorpay_signature === 'simulated') {
            // This used to be enough on its own, so any partner could ask for a
            // paid plan and be given it.
            if (!SIMULATED_PAYMENTS_ALLOWED) {
                return res.status(400).json({ message: 'Payment could not be verified', success: false });
            }
            isVerified = true;
        } else {
            const claim = await claimPayment(req, { purpose: 'subscription', principal: req.user._id });
            if (claim.error) {
                return res.status(claim.status).json({ message: claim.error, success: false });
            }
            isVerified = true;
        }

        if (isVerified) {
            const Provider = require('../models/Provider');
            const SubscriptionPlan = require('../models/SubscriptionPlan');

            const plan = await SubscriptionPlan.findById(planId);
            if (!plan) return res.status(404).json({ message: "Subscription plan not found" });

            const provider = await Provider.findById(req.user._id);
            if (!provider) return res.status(404).json({ message: "Provider not found" });

            // --- RozSewa Coins: subscription discount (Partner / Sewak only) ---
            // As on the customer side, the client sends only the id of a hold it
            // reserved via POST /api/coins/hold. The discount is re-derived here
            // from the hold and the plan's own price.
            let coinRedemptionId = null;
            let coinsRedeemed = 0;
            let coinDiscount = 0;

            if (req.body.coinRedemptionId) {
                const CoinService = require('../services/CoinService');
                const CoinRedemption = require('../models/CoinRedemption');

                const redemption = await CoinRedemption.findById(req.body.coinRedemptionId);
                if (!redemption) {
                    return res.status(400).json({ message: 'Your coin discount is no longer valid. Please re-apply your coins.' });
                }
                if (redemption.ownerId.toString() !== provider._id.toString()) {
                    return res.status(403).json({ message: 'Not authorized to use this coin redemption.' });
                }
                // Partner/Sewak coins are subscription-only.
                if (redemption.purpose !== 'subscription') {
                    return res.status(400).json({ message: 'These coins cannot be used for a subscription discount.' });
                }
                if (redemption.status !== 'held') {
                    return res.status(400).json({ message: `This coin discount has already been ${redemption.status}.` });
                }

                const coinConfig = await CoinService.getConfig();
                const ownerType = provider.providerCategory === 'sewak' ? 'sewak' : 'partner';
                const rc = CoinService.roleConfig(coinConfig, ownerType);
                const maxDiscount = Math.floor((Number(plan.price) * (Number(rc.maxDiscountPercent) || 0)) / 100);

                if (redemption.monetaryValue > maxDiscount) {
                    return res.status(400).json({
                        message: `Coins can cover at most Rs ${maxDiscount} of this plan. Please re-apply your coins.`
                    });
                }

                coinRedemptionId = redemption._id;
                coinsRedeemed = redemption.coins;
                coinDiscount = redemption.monetaryValue;
            }

            const pricePaid = Math.max(0, Number(plan.price) - coinDiscount);

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
            const providerSubscription = await ProviderSubscription.create({
                provider: provider._id,
                subscription: plan._id,
                startDate: purchaseDate,
                endDate: expiryDate,
                planPrice: plan.price,
                pricePaid,
                coinRedemptionId,
                coinsRedeemed,
                coinDiscount,
                status: 'active'
            });

            // The subscription exists, so the coins are genuinely spent now.
            // A failure here must not un-sell an active subscription, so it is
            // logged rather than thrown.
            if (coinRedemptionId) {
                try {
                    const CoinService = require('../services/CoinService');
                    await CoinService.commit(coinRedemptionId, {
                        referenceId: providerSubscription._id.toString(),
                        referenceModel: 'ProviderSubscription'
                    });
                } catch (coinErr) {
                    console.error('[Coins] Failed to commit subscription redemption:', coinErr.message);
                }
            }

            // Update provider subscription status (for legacy compatibility)
            provider.isSubscribed = true;
            provider.subscriptionPurchaseDate = purchaseDate;
            provider.subscriptionExpiry = expiryDate;
            // Legacy mirror field records what was actually charged, so revenue
            // reporting off the Provider document doesn't over-count the
            // coin-discounted portion.
            provider.subscriptionPrice = pricePaid;
            provider.subscriptionPlan = plan._id;
            provider.subscriptionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;
            provider.subscriptionType = plan.offeredCommissionType || 'percentage';
            provider.planType = (plan.name && (plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('elite') || plan.name.toLowerCase().includes('gold'))) ? 'pro' : (plan.name && plan.name.toLowerCase().includes('premium') ? 'premium' : 'standard');

            // Update the actual commission rate used for bookings (legacy)
            provider.commissionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;
            provider.settlementType = plan.settlementType || 'monday';

            await provider.save();

            res.json({ message: "Subscription activated successfully!", success: true });
        } else {
            res.status(400).json({ message: "Invalid payment signature", success: false });
        }
    } catch (error) {
        console.error("verifySubscriptionPayment error:", error);
        res.status(500).json({ message: error.message || "Server error while verifying subscription", success: false });
    }
};

// @desc    Verify Razorpay Payment for Wallet Recharge / Debt Settlement
// @route   POST /api/payment/verify-wallet
// @access  Private (Provider)
const verifyWalletRecharge = async (req, res) => {
    const { razorpay_payment_id } = req.body;

    const claim = await claimPayment(req, { purpose: 'wallet', principal: req.user._id });
    if (claim.error) {
        return res.status(claim.status).json({ message: claim.error, success: false });
    }

    {
        const { Wallet, Transaction } = require('../models/Wallet');
        const Provider = require('../models/Provider');

        let wallet = await Wallet.findOne({ providerId: req.user._id });
        if (!wallet) {
            wallet = await Wallet.create({ providerId: req.user._id, balance: 0 });
        }

        const isDebtSettlement = wallet.balance < 0;
        // What was actually paid, off the order raised for it. Taking this from
        // the request meant a rupee could be paid and any sum credited, because
        // the amount is no part of what Razorpay signs.
        const rechargeAmount = claim.order.amount;
        wallet.balance += rechargeAmount;
        wallet.cashCommissionDues = Math.max(0, (wallet.cashCommissionDues || 0) - rechargeAmount);
        await wallet.save();

        await Transaction.create({
            providerId: req.user._id,
            title: isDebtSettlement ? 'Debt Settlement' : 'Wallet Recharge',
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
    }
};

// @desc    Verify Razorpay Payment for User Wallet Recharge
// @route   POST /api/payment/verify-user-wallet
// @access  Private (User)
const verifyUserWalletRecharge = async (req, res) => {
    const { razorpay_payment_id } = req.body;

    const claim = await claimPayment(req, { purpose: 'wallet', principal: req.user._id });
    if (claim.error) {
        return res.status(claim.status).json({ message: claim.error, success: false });
    }

    {
        const { Wallet, Transaction } = require('../models/Wallet');

        // Credited from the order that was actually paid, never from the
        // request. The signature covers the order and payment ids only, so a
        // caller-supplied amount was a caller-supplied balance.
        const rechargeAmount = claim.order.amount;
        const wallet = await Wallet.findOneAndUpdate(
            { userId: req.user._id },
            { $inc: { balance: rechargeAmount }, $setOnInsert: { userId: req.user._id } },
            { new: true, upsert: true }
        );

        await Transaction.create({
            userId: req.user._id,
            title: 'Added Money to Wallet',
            amount: rechargeAmount,
            type: 'credit',
            status: 'completed',
            description: `Recharge via Razorpay (ID: ${razorpay_payment_id})`
        });

        res.json({ message: "Money added successfully!", success: true, walletBalance: wallet.balance });
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
        // A reminder fan-out: only who to reach and what to call them, and
        // capped so one bad expiry date cannot turn this into a full scan.
        const providers = await Provider.find({
            isSubscribed: true,
            subscriptionExpiry: {
                $gte: today,
                $lte: twoDaysLater
            }
        })
            .select('ownerName shopName mobile email subscriptionExpiry fcmTokens')
            .limit(5000)
            .lean();

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
    const { leadId } = req.body;

    const claim = await claimPayment(req, { purpose: 'lead', principal: req.user._id });
    if (claim.error) {
        return res.status(claim.status).json({ message: claim.error, success: false });
    }

    {
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
    const { offerId } = req.body;

    const claim = await claimPayment(req, { purpose: 'bazaar', principal: req.user._id });
    if (claim.error) {
        return res.status(claim.status).json({ success: false, message: claim.error });
    }

    {
        const BazaarOffer = require('../models/BazaarOffer');
        const offer = await BazaarOffer.findById(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        // We assume the buyer paid this. Set isLeadUnlockedByBuyer to true.
        offer.isLeadUnlockedByBuyer = true;
        await offer.save();

        res.json({ success: true, message: 'Payment verified! Contact details unlocked.' });
    }
};

module.exports.verifyBazaarPayment = verifyBazaarPayment;


// @desc    Verify Razorpay Payment for a Starter Kit / Combo Pack order
// @route   POST /api/payment/verify-kit-order
// @access  Private (Sewak)
const verifyKitOrderPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, isSimulated } = req.body;

        let isVerified = false;
        if (isSimulated || razorpay_signature === 'simulated') {
            // The kit checkout was never wired to a gateway, so this branch was
            // handing out kits for nothing. It now needs the environment's
            // consent, which production must not give.
            if (!SIMULATED_PAYMENTS_ALLOWED) {
                return res.status(400).json({
                    success: false,
                    message: 'Kit payments are not available yet. Please try again later.'
                });
            }
            isVerified = true;
        } else {
            const claim = await claimPayment(req, { purpose: 'kit', principal: req.user._id });
            if (claim.error) {
                return res.status(claim.status).json({ success: false, message: claim.error });
            }
            isVerified = true;
        }

        if (!isVerified) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Payment is good — hand off to the order controller, which owns the
        // frozen-snapshot logic so the charged amount and the stored order agree.
        const { placeOrder } = require('./kitOrderController');
        return placeOrder(req, res);
    } catch (error) {
        console.error('verifyKitOrderPayment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports.verifyKitOrderPayment = verifyKitOrderPayment;
