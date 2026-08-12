const CommissionSlab = require('../../models/CommissionSlab');

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
            console.warn(`[CommissionEngine] No CATEGORY_SLAB configured for category="${category.name || catId}" role="${role}" — falling through to GLOBAL_DEFAULT.`);
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

        console.warn(`[CommissionEngine] Booking amount ${bookingAmount} falls in a gap between configured CATEGORY_SLAB ranges for category="${category.name || catId}" role="${role}" — falling through to GLOBAL_DEFAULT.`);
        return null;
    }
}

module.exports = CategorySlabStrategy;
