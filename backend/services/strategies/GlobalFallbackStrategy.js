const CommissionSlab = require('../../models/CommissionSlab');
const Setting = require('../../models/Setting');

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

        if (!matchedSlab) {
            console.warn(`[CommissionEngine] Booking amount ${bookingAmount} (role="${role}") matched no GLOBAL_DEFAULT slab either (${globalSlabs.length} configured) — using the platform default rate.`);
        }

        if (matchedSlab) {
            return {
                rate: matchedSlab.commissionRate,
                source: 'GLOBAL_DEFAULT',
                ruleName: this.getMetadata().name,
                metadata: {
                    slabId: matchedSlab._id,
                    slabRange: `${matchedSlab.minAmount}-${matchedSlab.maxAmount}`
                }
            };
        }

        // Ultimate fallback: read admin-configured default rate from DB.
        // Only falls back to 10% if the setting has never been configured.
        const rateSetting = await Setting.findOne({ key: 'default_commission_rate' });
        const fallbackRate = (rateSetting && typeof rateSetting.value === 'number' && !isNaN(rateSetting.value))
            ? rateSetting.value
            : 10;

        return {
            rate: fallbackRate,
            source: 'GLOBAL_DEFAULT',
            ruleName: `Global Fallback Default (${fallbackRate}%)`,
            metadata: {
                slabRange: `Default Fallback (${fallbackRate}%)`
            }
        };
    }
}

module.exports = GlobalFallbackStrategy;
