const ProviderSubscription = require('../../models/ProviderSubscription');

class SubscriptionStrategy {
    getMetadata() {
        return {
            id: "SUBSCRIPTION",
            name: "Subscription Plan Commission",
            description: "Reduced commission rate for providers with active subscription plans",
            enabled: true
        };
    }
    
    async evaluate(bookingAmount, provider, category) {
        // Resolve active subscription
        const activeSub = await ProviderSubscription.findOne({
            provider: provider._id,
            status: 'active',
            endDate: { $gte: new Date() }
        }).populate('subscription');

        if (activeSub && activeSub.subscription) {
            const plan = activeSub.subscription;
            // Use commissionRate, fallback to offeredCommissionRate
            const rate = plan.commissionRate !== undefined && plan.commissionRate !== null 
                ? plan.commissionRate 
                : plan.offeredCommissionRate;

            return {
                rate: rate,
                source: 'SUBSCRIPTION',
                ruleName: this.getMetadata().name,
                subscriptionSnapshot: {
                    planId: plan._id,
                    planName: plan.name,
                    planPrice: plan.price,
                    benefits: plan.benefits || []
                },
                metadata: {
                    subscriptionPlanId: plan._id,
                    subscriptionPlanName: plan.name,
                    subscriptionPlanPrice: plan.price
                }
            };
        }

        return null;
    }
}

module.exports = SubscriptionStrategy;
