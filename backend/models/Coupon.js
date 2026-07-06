const mongoose = require('mongoose');

const couponSchema = mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discount: { type: String, required: true }, // e.g. '20%' or '100'
    description: { type: String },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    maxUsage: { type: Number, default: 100 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number },
    targetCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // Null means global
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
