class CommissionService {
    /**
     * Performs stateless commission calculation based on selected rule config.
     * Never reads or writes to database.
     */
    static calculate(bookingAmount, ruleConfig) {
        if (bookingAmount === undefined || bookingAmount === null || typeof bookingAmount !== 'number' || isNaN(bookingAmount)) {
            throw new Error("Invalid booking amount: must be a number");
        }
        if (bookingAmount < 0) {
            throw new Error("Invalid booking amount: must be non-negative");
        }
        if (!ruleConfig || typeof ruleConfig !== 'object') {
            throw new Error("Invalid rule configuration: must be an object");
        }

        const rate = Number(ruleConfig.rate) !== undefined && !isNaN(Number(ruleConfig.rate)) ? Number(ruleConfig.rate) : 0;
        if (rate < 0 || rate > 100) {
            throw new Error("Invalid commission rate: must be between 0 and 100");
        }

        const isFreeOrWaived = ruleConfig.isFreeTrial || ruleConfig.isWaiver || rate === 0;

        const commissionAmount = isFreeOrWaived ? 0 : Math.round(((bookingAmount * rate) / 100) * 100) / 100;
        const providerAmount = Math.round((bookingAmount - commissionAmount) * 100) / 100;
        const platformAmount = commissionAmount;

        return {
            commissionRate: rate,
            commissionAmount,
            providerAmount,
            platformAmount,
            source: ruleConfig.source || 'GLOBAL_DEFAULT',
            ruleApplied: ruleConfig.ruleName || 'Default Fallback',
            metadata: ruleConfig.metadata || {},
            subscriptionSnapshot: ruleConfig.subscriptionSnapshot || null
        };
    }
}

module.exports = CommissionService;
