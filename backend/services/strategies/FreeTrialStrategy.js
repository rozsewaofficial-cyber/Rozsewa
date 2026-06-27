const PartnerProgram = require('../../models/PartnerProgram');

class FreeTrialStrategy {
    getMetadata() {
        return {
            id: "FREE_TRIAL",
            name: "Free Onboarding Benefits",
            description: "Quota of free trial jobs for new joining partners",
            enabled: true
        };
    }
    
    async evaluate(bookingAmount, provider, category) {
        const rules = await PartnerProgram.findOne();
        const enabled = rules ? rules.freeTrialEnabled : true;
        const total = rules ? rules.freeServiceCount : 3;
        
        if (!enabled) return null;
        if (provider.freeTrial && provider.freeTrial.trialCompletedAt) return null;

        // Check category eligibility
        if (rules && rules.applyTo === 'selected' && category) {
            const isEligible = rules.selectedCategories.some(
                catId => catId.toString() === category._id.toString()
            );
            if (!isEligible) return null;
        }

        const extra = provider.freeTrial?.extraFreeServices || 0;
        const used = provider.freeTrial?.usedServices || 0;
        const remaining = total + extra - used;

        if (remaining > 0) {
            return {
                rate: 0,
                source: 'FREE_TRIAL',
                ruleName: this.getMetadata().name,
                isFreeTrial: true,
                metadata: {
                    totalServices: total,
                    extraFreeServices: extra,
                    usedServices: used,
                    remainingServices: remaining
                }
            };
        }

        return null;
    }
}

module.exports = FreeTrialStrategy;
