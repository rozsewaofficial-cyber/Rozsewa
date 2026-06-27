class ProviderOverrideStrategy {
    getMetadata() {
        return {
            id: "PROVIDER_OVERRIDE",
            name: "Provider Override Commission",
            description: "Custom override commission rate configured for a specific provider",
            enabled: true
        };
    }
    
    async evaluate(bookingAmount, provider, category) {
        const override = provider.commissionOverride;
        if (!override || !override.enabled) return null;

        return {
            rate: override.rate,
            source: 'PROVIDER_OVERRIDE',
            ruleName: this.getMetadata().name,
            metadata: {
                reason: override.reason,
                overrideRate: override.rate
            }
        };
    }
}

module.exports = ProviderOverrideStrategy;
