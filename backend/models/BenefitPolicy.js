const mongoose = require('mongoose');

const benefitPolicySchema = mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'ShieldCheck' }, // Lucide icon name
    color: { type: String, default: 'text-emerald-600' },
    bgColor: { type: String, default: 'bg-emerald-50' },
    type: { type: String, enum: ['benefit', 'policy'], default: 'benefit' }, // 'benefit' for grid, 'policy' for list
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 }
}, {
    timestamps: true
});

const BenefitPolicy = mongoose.model('BenefitPolicy', benefitPolicySchema);
module.exports = BenefitPolicy;
