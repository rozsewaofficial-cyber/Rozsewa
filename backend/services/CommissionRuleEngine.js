const ProviderSubscription = require('../models/ProviderSubscription');

const FreeTrialStrategy = require('./strategies/FreeTrialStrategy');
const WaiverStrategy = require('./strategies/WaiverStrategy');
const ProviderOverrideStrategy = require('./strategies/ProviderOverrideStrategy');
const SubscriptionStrategy = require('./strategies/SubscriptionStrategy');
const CategorySlabStrategy = require('./strategies/CategorySlabStrategy');
const GlobalFallbackStrategy = require('./strategies/GlobalFallbackStrategy');

class CommissionRuleEngine {
    constructor() {
        this.strategies = [
            new FreeTrialStrategy(),
            new WaiverStrategy(),
            new ProviderOverrideStrategy(),
            new SubscriptionStrategy(),
            new CategorySlabStrategy(),
            new GlobalFallbackStrategy()
        ];
    }

    /**
     * Loops through rules based on global rulePriority.
     * Performs real-time validation for provider subscription.
     */
    async selectRule(bookingAmount, provider, category, session) {
        // 1. Real-time Subscription Expiry Check
        if (provider.isSubscribed && provider.subscriptionExpiry) {
            if (new Date(provider.subscriptionExpiry) < new Date()) {
                provider.isSubscribed = false;
                provider.subscriptionExpiry = null;
                await provider.save();
                
                await ProviderSubscription.updateMany(
                    { provider: provider._id, status: 'active' },
                    { status: 'expired' }
                );
            }
        }

        // 2. Fixed evaluation sequence
        const rulePriority = ['FREE_TRIAL', 'WAIVER', 'PROVIDER_OVERRIDE', 'SUBSCRIPTION', 'CATEGORY_SLAB', 'GLOBAL_DEFAULT'];

        // 3. Execute strategies sequentially in priority order
        for (const ruleId of rulePriority) {
            const strategy = this.strategies.find(s => s.getMetadata().id === ruleId);
            if (strategy) {
                const match = await strategy.evaluate(bookingAmount, provider, category, session);
                if (match) {
                    return {
                        ruleId: strategy.getMetadata().id,
                        ruleName: strategy.getMetadata().name,
                        ...match
                    };
                }
            }
        }

        // Fallback if priority list doesn't match anything
        const fallback = new GlobalFallbackStrategy();
        const fallbackMatch = await fallback.evaluate(bookingAmount, provider, category, session);
        return {
            ruleId: fallback.getMetadata().id,
            ruleName: fallback.getMetadata().name,
            ...fallbackMatch
        };
    }
}

// Export singleton instance
module.exports = new CommissionRuleEngine();
