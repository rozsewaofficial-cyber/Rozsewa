const CommissionSlab = require('../../models/CommissionSlab');

class GlobalFallbackStrategy {
    getMetadata() {
        return {
            id: "GLOBAL_DEFAULT",
            name: "Global Default Slab",
            description: "Fallback default commission slabs when no category specific rule matches",
            enabled: true
        };
    }
    
    async evaluate(bookingAmount, provider, category) {
        const role = provider?.providerCategory || 'partner';
        // Find slabs with no category (null represents global default) matching provider role
        const globalSlabs = await CommissionSlab.find({ 
            category: null,
            $or: [
                { providerCategory: { $in: ['all', role] } },
                { providerCategory: { $exists: false } },
                { providerCategory: null }
            ]
        }).sort({ minAmount: 1 });
        
        const matchedSlab = globalSlabs.find(s => bookingAmount >= s.minAmount && bookingAmount <= s.maxAmount);
        
        if (matchedSlab) {
            return {
                rate: matchedSlab.commissionRate,
                source: 'CATEGORY_SLAB', // generic fallback source
                ruleName: this.getMetadata().name,
                metadata: {
                    slabId: matchedSlab._id,
                    slabRange: `${matchedSlab.minAmount}-${matchedSlab.maxAmount}`
                }
            };
        }

        // Ultimate fallback rate if database is unseeded
        return {
            rate: 10,
            source: 'CATEGORY_SLAB',
            ruleName: "Global Fallback Default (10%)",
            metadata: {
                slabRange: "Default Fallback (10%)"
            }
        };
    }
}

module.exports = GlobalFallbackStrategy;
