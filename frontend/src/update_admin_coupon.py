import os
import re

file_path = r"d:\Rojsewa-main\backend\controllers\adminController.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

coupon_functions = """
// @desc    Get all coupons for admin
// @route   GET /api/admin/coupons
// @access  Private/Admin
const getAdminCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().populate('targetCategory', 'name').sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new coupon
// @route   POST /api/admin/coupons
// @access  Private/Admin
const createCoupon = async (req, res) => {
    try {
        const { code, discount, description, expiryDate, maxUsage, minOrderAmount, maxDiscountAmount, targetCategory } = req.body;
        
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discount,
            description,
            expiryDate,
            maxUsage,
            minOrderAmount,
            maxDiscountAmount,
            targetCategory: targetCategory || null
        });

        await newCoupon.save();
        const savedCoupon = await Coupon.findById(newCoupon._id).populate('targetCategory', 'name');
        res.status(201).json(savedCoupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle coupon status
// @route   PUT /api/admin/coupons/:id/toggle
// @access  Private/Admin
const toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        
        if (coupon.expiryDate < new Date()) {
            return res.status(400).json({ message: 'Cannot enable an expired coupon' });
        }

        coupon.isActive = !coupon.isActive;
        await coupon.save();
        
        const updatedCoupon = await Coupon.findById(coupon._id).populate('targetCategory', 'name');
        res.json(updatedCoupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a coupon
// @route   DELETE /api/admin/coupons/:id
// @access  Private/Admin
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        
        await Coupon.deleteOne({ _id: coupon._id });
        res.json({ message: 'Coupon removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
"""

# Insert right before module.exports = {
if "module.exports = {" in content:
    content = content.replace("module.exports = {", coupon_functions + "\nmodule.exports = {")
    
    # Also we need to export the functions
    export_string = """    clearUnauthorizedPaymentFlag,
    getBookingPaymentAudit,
    getAdminCoupons,
    createCoupon,
    toggleCouponStatus,
    deleteCoupon,"""
    content = content.replace("    clearUnauthorizedPaymentFlag,\n    getBookingPaymentAudit,", export_string)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated adminController.js")
else:
    print("Could not find module.exports = { in adminController.js")
