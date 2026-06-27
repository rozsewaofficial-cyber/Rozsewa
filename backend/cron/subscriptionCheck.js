const cron = require('node-cron');
const Provider = require('../models/Provider');
const ProviderSubscription = require('../models/ProviderSubscription');
const { notifyUser } = require('../config/notificationService');

const runSubscriptionCheck = async () => {
    console.log('[Cron] Running Daily Subscription Expiry Check...');
    try {
        const today = new Date();
        
        // Find active subscriptions expiring soon
        const activeSubs = await ProviderSubscription.find({ status: 'active' }).populate('provider');

        for (const sub of activeSubs) {
            if (!sub.provider) continue;

            const expiry = new Date(sub.endDate);
            const providerId = sub.provider._id;

            // Calculate days diff
            const diffTime = expiry - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 3) {
                await notifyUser({
                    userId: providerId,
                    userRole: 'provider',
                    title: "Subscription Expiring in 3 Days",
                    message: `Your active plan is expiring in 3 days. Please renew to keep your commission discount.`,
                    type: 'system'
                });
            } else if (diffDays === 1) {
                await notifyUser({
                    userId: providerId,
                    userRole: 'provider',
                    title: "Subscription Expiring Tomorrow",
                    message: `Your active plan expires tomorrow. Renew now from your dashboard.`,
                    type: 'system'
                });
            } else if (expiry <= today) {
                // Expired! Update DB status and provider status
                sub.status = 'expired';
                await sub.save();

                const provider = await Provider.findById(providerId);
                if (provider) {
                    provider.isSubscribed = false;
                    provider.commissionRate = 10; // Restore default fallback
                    await provider.save();

                    await notifyUser({
                        userId: providerId,
                        userRole: 'provider',
                        title: "Subscription Expired",
                        message: `Your subscription has expired. Reverting to category commission slabs.`,
                        type: 'system'
                    });
                }
            }
        }
    } catch (error) {
        console.error('[Cron Error] Subscription expiry check failed:', error);
    }
};

const startSubscriptionCheckCron = () => {
    // Run daily at midnight 00:00
    cron.schedule('0 0 * * *', runSubscriptionCheck);
    console.log('[Cron] Subscription Check Cron initialized (runs daily at 00:00).');
};

module.exports = {
    startSubscriptionCheckCron,
    runSubscriptionCheck
};
