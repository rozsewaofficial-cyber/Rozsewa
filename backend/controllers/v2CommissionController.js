const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const PartnerProgram = require('../models/PartnerProgram');
const Category = require('../models/Category');
const ProviderSubscription = require('../models/ProviderSubscription');
const CommissionLog = require('../models/CommissionLog');
const FinancialLedger = require('../models/FinancialLedger');
const AuditLog = require('../models/AuditLog');
const CommissionRuleEngine = require('../services/CommissionRuleEngine');
const CommissionService = require('../services/CommissionService');
const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { Wallet, Transaction } = require('../models/Wallet');
const { notifyUser } = require('../config/notificationService');



// @desc    Adjust provider free trial manually
// @route   POST /api/v2/admin/providers/:id/free-trial/adjust
// @access  Private (Admin)
exports.adjustFreeTrial = async (req, res) => {
    try {
        const { action, amount, reason } = req.body;
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const prevValue = provider.freeTrial ? { ...provider.freeTrial.toObject() } : {};

        if (!provider.freeTrial) {
            provider.freeTrial = { usedServices: 0, extraFreeServices: 0 };
        }

        if (action === 'reset') {
            provider.freeTrial.usedServices = 0;
            provider.freeTrial.trialCompletedAt = null;
        } else if (action === 'grant') {
            provider.freeTrial.extraFreeServices = (provider.freeTrial.extraFreeServices || 0) + (Number(amount) || 1);
            provider.freeTrial.trialCompletedAt = null;
        } else if (action === 'remove') {
            provider.freeTrial.extraFreeServices = Math.max(0, (provider.freeTrial.extraFreeServices || 0) - (Number(amount) || 1));
        } else {
            return res.status(400).json({ message: "Invalid action. Supported: reset, grant, remove" });
        }

        await provider.save();

        await AuditLog.create({
            actionType: 'VERIFY', // legacy match
            entityType: 'PROVIDER',
            entityId: provider._id,
            entityName: provider.shopName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || req.user.name || 'Admin',
            verifiedByRole: 'Admin',
            details: {
                action,
                amount,
                previousTrial: prevValue,
                newTrial: provider.freeTrial.toObject()
            },
            ipAddress: req.ip || '',
            reason: reason || `Manual adjustment of free trial: ${action}`
        });

        // Trigger notification
        await notifyUser({
            userId: provider._id,
            userRole: 'provider',
            title: "Free Trial Quota Adjusted",
            message: `Your free trial quota has been adjusted by support. Action: ${action.toUpperCase()}, Amount: ${amount}.`,
            type: 'system'
        });

        res.json({ message: "Free trial adjusted successfully", freeTrial: provider.freeTrial });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Configure commission waiver for provider
// @route   POST /api/v2/admin/providers/:id/waiver
// @access  Private (Admin)
exports.configureWaiver = async (req, res) => {
    try {
        const { enabled, untilDate, maxBookings, reason } = req.body;
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const prevWaiver = provider.commissionWaiver ? { ...provider.commissionWaiver.toObject() } : {};

        if (!provider.commissionWaiver) {
            provider.commissionWaiver = { enabled: false, bookingsWaivedCount: 0 };
        }

        provider.commissionWaiver.enabled = enabled !== undefined ? enabled : provider.commissionWaiver.enabled;
        provider.commissionWaiver.untilDate = untilDate || null;
        provider.commissionWaiver.maxBookings = maxBookings !== undefined ? (maxBookings === "" ? null : Number(maxBookings)) : provider.commissionWaiver.maxBookings;
        provider.commissionWaiver.reason = reason || "";
        provider.commissionWaiver.updatedAt = Date.now();

        await provider.save();

        await AuditLog.create({
            actionType: 'VERIFY',
            entityType: 'PROVIDER',
            entityId: provider._id,
            entityName: provider.shopName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || req.user.name || 'Admin',
            verifiedByRole: 'Admin',
            details: {
                previousWaiver: prevWaiver,
                newWaiver: provider.commissionWaiver.toObject()
            },
            ipAddress: req.ip || '',
            reason: reason || 'Configured commission waiver settings'
        });

        // Trigger notification
        await notifyUser({
            userId: provider._id,
            userRole: 'provider',
            title: "Waiver Status Changed",
            message: enabled
                ? `A commission waiver has been activated for you. You will be charged 0% commission on your next bookings.`
                : `Commission waiver has been deactivated.`,
            type: 'system'
        });

        res.json({ message: "Waiver settings updated successfully", commissionWaiver: provider.commissionWaiver });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get commission analytics and dashboards
// @route   GET /api/v2/admin/commission/analytics
// @access  Private (Admin)
exports.getCommissionAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, categoryId, providerId, subscriptionId } = req.query;

        // Build completed bookings query matcher
        const matchQuery = { status: 'completed' };

        if (startDate || endDate) {
            matchQuery.completedAt = {};
            if (startDate) matchQuery.completedAt.$gte = new Date(startDate);
            if (endDate) matchQuery.completedAt.$lte = new Date(endDate);
        }

        if (categoryId) {
            matchQuery['commissionSnapshot.bookingCategorySnapshot.id'] = new mongoose.Types.ObjectId(categoryId);
        }
        if (providerId) {
            matchQuery.providerId = new mongoose.Types.ObjectId(providerId);
        }
        if (subscriptionId) {
            matchQuery['commissionSnapshot.subscriptionSnapshot.planId'] = new mongoose.Types.ObjectId(subscriptionId);
        }

        const bookings = await Booking.find(matchQuery);

        // Compute KPIs
        let gmv = 0;
        let platformRevenue = 0;
        let subscriptionRevenue = 0;
        let payouts = 0;
        let totalBookingsCount = bookings.length;

        // Commission Sources buckets
        const sourceCounts = { FREE_TRIAL: 0, WAIVER: 0, PROVIDER_OVERRIDE: 0, SUBSCRIPTION: 0, CATEGORY_SLAB: 0, GLOBAL_DEFAULT: 0 };
        const sourceRevenue = { FREE_TRIAL: 0, WAIVER: 0, PROVIDER_OVERRIDE: 0, SUBSCRIPTION: 0, CATEGORY_SLAB: 0, GLOBAL_DEFAULT: 0 };

        // Category & Subscription Breakdown maps
        const categoryRevMap = {};
        const subPlanRevMap = {};

        bookings.forEach(b => {
            const snap = b.commissionSnapshot || {};
            const amt = b.totalAmount || 0;
            const comm = snap.commissionAmount !== undefined ? snap.commissionAmount : (b.adminCommission || 0);
            const payout = snap.providerEarnings !== undefined ? snap.providerEarnings : (b.providerPayout || (amt - comm));

            gmv += amt;
            platformRevenue += comm;
            payouts += payout;

            const src = snap.commissionSource || (b.commissionStatus ? b.commissionStatus.toUpperCase() : 'CATEGORY_SLAB');
            const cleanSrc = sourceCounts[src] !== undefined ? src : 'CATEGORY_SLAB';
            
            sourceCounts[cleanSrc]++;
            sourceRevenue[cleanSrc] += comm;

            // Category breakdown
            const catName = snap.bookingCategorySnapshot?.name || 'Global Fallback';
            categoryRevMap[catName] = (categoryRevMap[catName] || 0) + comm;

            // Plan breakdown
            if (snap.subscriptionSnapshot?.planName) {
                const planName = snap.subscriptionSnapshot.planName;
                subPlanRevMap[planName] = (subPlanRevMap[planName] || 0) + comm;
            }
        });

        // Query subscription payments from Ledger for total subscription revenues
        const ledgerQuery = { ledgerType: 'SUBSCRIPTION_PAYMENT' };
        if (startDate || endDate) {
            ledgerQuery.createdAt = {};
            if (startDate) ledgerQuery.createdAt.$gte = new Date(startDate);
            if (endDate) ledgerQuery.createdAt.$lte = new Date(endDate);
        }
        if (providerId) {
            ledgerQuery.provider = new mongoose.Types.ObjectId(providerId);
        }
        const subscriptionPayments = await FinancialLedger.find(ledgerQuery);
        subscriptionRevenue = subscriptionPayments.reduce((sum, item) => sum + Math.abs(item.amount), 0);

        const netRevenue = platformRevenue + subscriptionRevenue;
        const avgCommissionPercent = gmv > 0 ? ((platformRevenue / gmv) * 100).toFixed(1) : 0;
        const avgBookingValue = totalBookingsCount > 0 ? (gmv / totalBookingsCount).toFixed(0) : 0;

        // Provider states counts
        const trialCount = await Provider.countDocuments({ 'freeTrial.trialCompletedAt': null });
        const overrideCount = await Provider.countDocuments({ 'commissionOverride.enabled': true });
        const waiverCount = await Provider.countDocuments({ 'commissionWaiver.enabled': true });
        const subscribedCount = await Provider.countDocuments({ isSubscribed: true });
        const activeProviders = await Provider.countDocuments({ status: 'verified' });

        // Category breakdown array for charts
        const categoryData = Object.keys(categoryRevMap).map(key => ({
            name: key,
            value: categoryRevMap[key]
        }));

        // Plan breakdown array
        const planData = Object.keys(subPlanRevMap).map(key => ({
            name: key,
            value: subPlanRevMap[key]
        }));

        // Rule Usage Distribution
        const ruleUsage = Object.keys(sourceCounts).map(key => ({
            source: key,
            bookings: sourceCounts[key],
            revenue: sourceRevenue[key]
        }));

        // Aggregated monthly trend aggregation pipeline
        const trends = await Booking.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$completedAt" } },
                    revenue: { $sum: { $ifNull: ["$commissionSnapshot.commissionAmount", "$adminCommission"] } },
                    gmv: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        const formattedTrends = trends.map(t => ({
            month: t._id,
            revenue: t.revenue,
            gmv: t.gmv
        }));

        res.json({
            kpis: {
                gmv,
                platformRevenue,
                subscriptionRevenue,
                netRevenue,
                payouts,
                avgCommissionPercent,
                avgBookingValue,
                mrr: (subscriptionRevenue / 12).toFixed(0)
            },
            providerKpis: {
                activeProviders,
                trialCount,
                overrideCount,
                waiverCount,
                subscribedCount
            },
            charts: {
                categoryBreakdown: categoryData,
                subscriptionPlanBreakdown: planData,
                ruleDistribution: ruleUsage,
                monthlyTrends: formattedTrends
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get real-time commission preview for provider
// @route   GET /api/v2/provider/commission-preview
// @access  Private (Provider)
exports.getCommissionPreview = async (req, res) => {
    try {
        const amount = Number(req.query.bookingAmount) || 1000;
        const provider = await Provider.findById(req.user._id).populate('vendorType');
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const matchedRule = await CommissionRuleEngine.selectRule(amount, provider, provider.vendorType);
        const calculation = CommissionService.calculate(amount, matchedRule);

        // Fetch active slab range if category slab is evaluated
        let activeSlabRange = "N/A";
        if (matchedRule.ruleId === 'CATEGORY_SLAB' && matchedRule.metadata?.slabRange) {
            activeSlabRange = matchedRule.metadata.slabRange;
        } else if (matchedRule.ruleId === 'GLOBAL_DEFAULT' && matchedRule.metadata?.slabRange) {
            activeSlabRange = matchedRule.metadata.slabRange;
        }

        // Days remaining calculation
        let daysRemaining = 0;
        if (provider.isSubscribed && provider.subscriptionExpiry) {
            const diff = new Date(provider.subscriptionExpiry) - new Date();
            daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        // Active subscription plan benefits
        let subscriptionBenefits = [];
        if (provider.isSubscribed) {
            const activeSub = await ProviderSubscription.findOne({ provider: provider._id, status: 'active' }).populate('subscription');
            if (activeSub && activeSub.subscription) {
                subscriptionBenefits = activeSub.subscription.features || [];
            }
        }

        res.json({
            currentRule: calculation.ruleApplied,
            appliedSource: calculation.source, // 'FREE_TRIAL', 'WAIVER', 'PROVIDER_OVERRIDE', 'SUBSCRIPTION', 'CATEGORY_SLAB', 'GLOBAL_DEFAULT'
            currentCommissionPercentage: calculation.commissionRate,
            remainingFreeServices: provider.freeServicesLeft,
            activeSubscription: provider.isSubscribed ? {
                planName: provider.planType || 'Elite Pro',
                expiry: provider.subscriptionExpiry,
                rate: provider.subscriptionRate,
                daysRemaining,
                benefits: subscriptionBenefits
            } : null,
            categoryCommission: {
                categoryName: provider.vendorType ? provider.vendorType.name : 'Global Fallback',
                commissionPercentage: calculation.commissionRate,
                activeSlabRange
            },
            estimatedCommission: calculation.commissionAmount,
            estimatedEarnings: calculation.providerAmount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Purchase subscription plan using wallet availableBalance
// @route   POST /api/v2/provider/subscription/purchase
// @access  Private (Provider)
exports.purchaseSubscription = async (req, res) => {
    const { planId } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const plan = await SubscriptionPlan.findById(planId).session(session);
        if (!plan || !plan.isActive) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Subscription plan not found or inactive" });
        }

        const provider = await Provider.findById(req.user._id).session(session);
        if (!provider) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Provider not found" });
        }

        let wallet = await Wallet.findOne({ providerId: provider._id }).session(session);
        if (!wallet) {
            wallet = (await Wallet.create([{ providerId: provider._id, balance: 0, availableBalance: 0 }], { session }))[0];
        }

        if (wallet.availableBalance < plan.price) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Insufficient available balance in wallet. Please add money first." });
        }

        // Deduct price
        const prevBal = wallet.availableBalance;
        wallet.availableBalance -= plan.price;
        await wallet.save({ session });

        // Deactivate active subscriptions
        await ProviderSubscription.updateMany(
            { provider: provider._id, status: 'active' },
            { status: 'expired' },
            { session }
        );

        const purchaseDate = new Date();
        const expiryDate = new Date();
        const durationDays = plan.duration || 365;
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        // Create subscription log
        const newSub = await ProviderSubscription.create([{
            provider: provider._id,
            subscription: plan._id,
            startDate: purchaseDate,
            endDate: expiryDate,
            pricePaid: plan.price,
            status: 'active'
        }], { session });

        // Update provider fields
        provider.isSubscribed = true;
        provider.subscriptionPurchaseDate = purchaseDate;
        provider.subscriptionExpiry = expiryDate;
        provider.subscriptionPrice = plan.price;
        provider.subscriptionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;
        provider.subscriptionType = plan.offeredCommissionType || 'percentage';
        provider.planType = (plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('gold')) ? 'pro' : (plan.name.toLowerCase().includes('premium') ? 'premium' : 'standard');
        provider.commissionRate = provider.subscriptionRate;

        await provider.save({ session });

        // Record Ledger and Transaction logs
        const txnId = `SUB-TXN-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;
        await FinancialLedger.create([{
            transactionId: txnId,
            provider: provider._id,
            ledgerType: 'SUBSCRIPTION_PAYMENT',
            amount: -plan.price,
            previousBalance: prevBal,
            newBalance: wallet.availableBalance,
            description: `Purchased subscription plan: ${plan.name}`,
            metadata: { planId: plan._id }
        }], { session });

        await Transaction.create([{
            providerId: provider._id,
            title: `Subscription Purchased: ${plan.name}`,
            amount: plan.price,
            type: 'debit',
            status: 'completed',
            description: `Active until ${expiryDate.toLocaleDateString()}`
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.json({ message: "Subscription purchased successfully", subscription: newSub[0] });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Renew subscription plan extending active expiry
// @route   POST /api/v2/provider/subscription/renew
// @access  Private (Provider)
exports.renewSubscription = async (req, res) => {
    const { planId } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const plan = await SubscriptionPlan.findById(planId).session(session);
        if (!plan || !plan.isActive) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Subscription plan not found or inactive" });
        }

        const provider = await Provider.findById(req.user._id).session(session);
        if (!provider) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Provider not found" });
        }

        let wallet = await Wallet.findOne({ providerId: provider._id }).session(session);
        if (!wallet) {
            wallet = (await Wallet.create([{ providerId: provider._id, balance: 0, availableBalance: 0 }], { session }))[0];
        }

        if (wallet.availableBalance < plan.price) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Insufficient available balance in wallet." });
        }

        // Check if there is an active subscription
        const activeSub = await ProviderSubscription.findOne({
            provider: provider._id,
            status: 'active',
            endDate: { $gte: new Date() }
        }).session(session);

        let startDate = new Date();
        if (activeSub && activeSub.subscription.toString() === plan._id.toString()) {
            // Extend existing subscription
            startDate = new Date(activeSub.endDate);
        }

        const expiryDate = new Date(startDate);
        const durationDays = plan.duration || 365;
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        // Deduct balance
        const prevBal = wallet.availableBalance;
        wallet.availableBalance -= plan.price;
        await wallet.save({ session });

        if (activeSub) {
            if (activeSub.subscription.toString() === plan._id.toString()) {
                activeSub.endDate = expiryDate;
                await activeSub.save({ session });
            } else {
                // Terminate old one, start new one
                activeSub.status = 'expired';
                await activeSub.save({ session });
                await ProviderSubscription.create([{
                    provider: provider._id,
                    subscription: plan._id,
                    startDate: new Date(),
                    endDate: expiryDate,
                    pricePaid: plan.price,
                    status: 'active'
                }], { session });
            }
        } else {
            await ProviderSubscription.create([{
                provider: provider._id,
                subscription: plan._id,
                startDate: new Date(),
                endDate: expiryDate,
                pricePaid: plan.price,
                status: 'active'
            }], { session });
        }

        // Update provider fields
        provider.isSubscribed = true;
        provider.subscriptionExpiry = expiryDate;
        provider.subscriptionPrice = plan.price;
        provider.subscriptionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;
        provider.subscriptionType = plan.offeredCommissionType || 'percentage';
        provider.commissionRate = provider.subscriptionRate;

        await provider.save({ session });

        // Record Logs
        const txnId = `SUB-REN-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;
        await FinancialLedger.create([{
            transactionId: txnId,
            provider: provider._id,
            ledgerType: 'SUBSCRIPTION_PAYMENT',
            amount: -plan.price,
            previousBalance: prevBal,
            newBalance: wallet.availableBalance,
            description: `Renewed subscription plan: ${plan.name}`,
            metadata: { planId: plan._id }
        }], { session });

        await Transaction.create([{
            providerId: provider._id,
            title: `Subscription Renewed: ${plan.name}`,
            amount: plan.price,
            type: 'debit',
            status: 'completed',
            description: `Extended until ${expiryDate.toLocaleDateString()}`
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.json({ message: "Subscription renewed successfully", expiryDate });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get subscription history for current provider
// @route   GET /api/v2/provider/subscription/history
// @access  Private (Provider)
exports.getProviderSubscriptionHistory = async (req, res) => {
    try {
        const history = await ProviderSubscription.find({ provider: req.user._id })
            .populate('subscription')
            .sort({ createdAt: -1 });

        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually activate provider subscription
// @route   POST /api/v2/admin/providers/:id/subscription/manual
// @access  Private (Admin)
exports.manualActivateSubscription = async (req, res) => {
    const { planId, expiryDate, reason } = req.body;
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) return res.status(404).json({ message: "Subscription plan not found" });

        // Deactivate existing
        await ProviderSubscription.updateMany(
            { provider: provider._id, status: 'active' },
            { status: 'expired' }
        );

        const purchaseDate = new Date();
        let expiry = expiryDate ? new Date(expiryDate) : null;
        if (!expiry) {
            expiry = new Date();
            expiry.setDate(expiry.getDate() + (plan.duration || 365));
        }

        const newSub = await ProviderSubscription.create({
            provider: provider._id,
            subscription: plan._id,
            startDate: purchaseDate,
            endDate: expiry,
            pricePaid: plan.price,
            status: 'active'
        });

        // Update provider fields
        provider.isSubscribed = true;
        provider.subscriptionPurchaseDate = purchaseDate;
        provider.subscriptionExpiry = expiry;
        provider.subscriptionPrice = plan.price;
        provider.subscriptionRate = plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate;
        provider.subscriptionType = plan.offeredCommissionType || 'percentage';
        provider.commissionRate = provider.subscriptionRate;

        await provider.save();

        await AuditLog.create({
            actionType: 'VERIFY',
            entityType: 'PROVIDER',
            entityId: provider._id,
            entityName: provider.shopName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || req.user.name || 'Admin',
            verifiedByRole: 'Admin',
            details: {
                action: 'manual_activate_subscription',
                plan: { id: plan._id, name: plan.name },
                expiryDate: expiry
            },
            reason: reason || `Manual subscription activation: ${plan.name}`
        });

        // Trigger notification
        await notifyUser({
            userId: provider._id,
            userRole: 'provider',
            title: "Subscription Activated",
            message: `Your manual subscription for plan "${plan.name}" has been activated by support.`,
            type: 'system'
        });

        res.json({ message: "Subscription activated manually", subscription: newSub });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually cancel provider subscription
// @route   POST /api/v2/admin/providers/:id/subscription/cancel
// @access  Private (Admin)
exports.manualCancelSubscription = async (req, res) => {
    const { reason } = req.body;
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        // Deactivate active subscriptions
        await ProviderSubscription.updateMany(
            { provider: provider._id, status: 'active' },
            { status: 'cancelled' }
        );

        provider.isSubscribed = false;
        provider.subscriptionExpiry = null;
        provider.subscriptionPurchaseDate = null;
        provider.subscriptionPrice = null;
        provider.subscriptionRate = null;
        provider.commissionRate = 10; // Restore category fallback

        await provider.save();

        await AuditLog.create({
            actionType: 'VERIFY',
            entityType: 'PROVIDER',
            entityId: provider._id,
            entityName: provider.shopName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || req.user.name || 'Admin',
            verifiedByRole: 'Admin',
            details: {
                action: 'manual_cancel_subscription'
            },
            reason: reason || 'Manual subscription cancellation'
        });

        // Trigger notification
        await notifyUser({
            userId: provider._id,
            userRole: 'provider',
            title: "Subscription Cancelled",
            message: `Your active subscription has been manually cancelled by support. Your commission rate has reverted to default.`,
            type: 'cancel'
        });

        res.json({ message: "Subscription cancelled manually" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Apply or remove provider commission override
// @route   POST /api/v2/admin/providers/:id/override
// @access  Private (Admin)
exports.applyOverride = async (req, res) => {
    try {
        const { enabled, rate, reason } = req.body;
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const prevOverride = provider.commissionOverride ? { ...provider.commissionOverride.toObject() } : {};

        provider.commissionOverride = {
            enabled: enabled !== undefined ? enabled : provider.commissionOverride.enabled,
            rate: rate !== undefined ? Number(rate) : provider.commissionOverride.rate,
            reason: reason || "",
            updatedAt: Date.now()
        };

        // Compatibility sync
        if (provider.commissionOverride.enabled) {
            provider.commissionRate = provider.commissionOverride.rate;
        } else {
            // Restore legacy category default
            provider.commissionRate = 10;
        }

        await provider.save();

        await AuditLog.create({
            actionType: 'VERIFY',
            entityType: 'PROVIDER',
            entityId: provider._id,
            entityName: provider.shopName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.ownerName || req.user.name || 'Admin',
            verifiedByRole: 'Admin',
            details: {
                previousOverride: prevOverride,
                newOverride: provider.commissionOverride.toObject()
            },
            reason: reason || 'Configured commission override settings'
        });

        // Trigger notification
        await notifyUser({
            userId: provider._id,
            userRole: 'provider',
            title: "Commission Configuration Updated",
            message: enabled 
                ? `A custom commission rate override of ${rate}% has been applied to your account by support.`
                : `Custom override has been removed. Category slabs commission is now active.`,
            type: 'system'
        });

        res.json({ message: "Override settings updated successfully", commissionOverride: provider.commissionOverride });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
