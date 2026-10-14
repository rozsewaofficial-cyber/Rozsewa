const CommissionSlab = require('../../models/CommissionSlab');

// A missing slab is an admin setting, not an error, and every commission
// preview (each dashboard load) hit it — so the same warning filled the log.
// Said at most once every 6 hours per category/role; the fallback is unchanged.
const WARN_EVERY_MS = 6 * 60 * 60 * 1000;
const lastWarned = new Map();
const warnOnce = (key, message) => {
    const now = Date.now();
    if (now - (lastWarned.get(key) || 0) < WARN_EVERY_MS) return;
    lastWarned.set(key, now);
    console.warn(message);
};

class CategorySlabStrategy {
    getMetadata() {
        return {
            id: "CATEGORY_SLAB",
            name: "Category Commission Slab",
            description: "Category-specific tiered commission slabs based on booking amount",
            enabled: true
        };
    }
    
    async evaluate(bookingAmount, provider, category) {
        if (!category) return null;

        const role = provider?.providerCategory || 'partner';
        
        const catId = category._id || category;
        
        // Find slabs for this category matching provider role
        const slabs = await CommissionSlab.find({ 
            category: catId,
            $or: [
                { providerCategory: { $in: ['all', role] } },
                { providerCategory: { $exists: false } },
                { providerCategory: null }
            ]
        }).sort({ minAmount: 1 });
        if (slabs.length === 0) {
            warnOnce(`none:${catId}:${role}`, `[CommissionEngine] No CATEGORY_SLAB configured for category="${category.name || catId}" role="${role}" — falling through to GLOBAL_DEFAULT.`);
            return null;
        }

        const matchedSlab = slabs.find(s => bookingAmount >= s.minAmount && bookingAmount <= s.maxAmount);
        if (matchedSlab) {
            return {
                rate: matchedSlab.commissionRate,
                source: 'CATEGORY_SLAB',
                ruleName: this.getMetadata().name,
                metadata: {
                    slabId: matchedSlab._id,
                    categoryId: category._id,
                    categoryName: category.name,
                    slabRange: `${matchedSlab.minAmount}-${matchedSlab.maxAmount}`
                }
            };
        }

        warnOnce(`gap:${catId}:${role}`, `[CommissionEngine] Booking amount ${bookingAmount} falls in a gap between configured CATEGORY_SLAB ranges for category="${category.name || catId}" role="${role}" — falling through to GLOBAL_DEFAULT.`);
        return null;
    }
}

module.exports = CategorySlabStrategy;
