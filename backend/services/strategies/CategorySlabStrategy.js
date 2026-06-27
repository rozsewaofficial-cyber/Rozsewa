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

        // Find slabs for this category
        const slabs = await CommissionSlab.find({ category: category._id }).sort({ minAmount: 1 });
        if (slabs.length === 0) return null;

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

        return null;
    }
}

module.exports = CategorySlabStrategy;
