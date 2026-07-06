import os

file_path = r"d:\Rojsewa-main\backend\controllers\homeController.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_validate = """const validateCoupon = async (req, res) => {
    try {
        const { code, amount } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid coupon code' });
        }

        if (new Date() > coupon.expiryDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        if (coupon.usageCount >= coupon.maxUsage) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        if (amount < coupon.minOrderAmount) {
            return res.status(400).json({ message: `Minimum order amount for this coupon is ₹${coupon.minOrderAmount}` });
        }

        res.json(coupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};"""

new_validate = """const validateCoupon = async (req, res) => {
    try {
        const { code, amount, serviceId } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true }).populate('targetCategory');

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid coupon code' });
        }

        if (new Date() > coupon.expiryDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        if (coupon.usageCount >= coupon.maxUsage) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        if (amount < coupon.minOrderAmount) {
            return res.status(400).json({ message: `Minimum order amount for this coupon is ₹${coupon.minOrderAmount}` });
        }

        // Validate Category Restriction
        if (coupon.targetCategory && serviceId) {
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(serviceId)) {
                const Service = require('../models/Service');
                const Combo = require('../models/Combo');
                const Category = require('../models/Category');

                let belongsToCategory = false;
                
                // 1. Check if it's a regular service
                const service = await Service.findById(serviceId);
                if (service) {
                    const category = await Category.findOne({ name: service.category });
                    if (category && category._id.toString() === coupon.targetCategory._id.toString()) {
                        belongsToCategory = true;
                    }
                }

                // 2. Check if it's a combo
                if (!belongsToCategory) {
                    const combo = await Combo.findById(serviceId);
                    if (combo) {
                        // Assuming combos might belong to categories, or just deny if strict
                        // In this system, combos are usually attached to providers or categories
                        // We will check if any of the combo's services belong to the category
                        // For simplicity, we might just allow combos if they have services in that category
                        // Let's check provider's vendorType (which is category)
                        const provider = await Provider.findById(combo.providerId);
                        if (provider && provider.vendorType.toString() === coupon.targetCategory._id.toString()) {
                            belongsToCategory = true;
                        }
                    }
                }

                // 3. Check if it's a category sub-service (Sewak)
                if (!belongsToCategory) {
                    const category = await Category.findOne({
                        $or: [
                            { "services._id": serviceId },
                            { "combos._id": serviceId }
                        ]
                    });
                    if (category && category._id.toString() === coupon.targetCategory._id.toString()) {
                        belongsToCategory = true;
                    }
                }

                if (!belongsToCategory) {
                    return res.status(400).json({ message: `This coupon is only valid for ${coupon.targetCategory.name} services.` });
                }
            }
        }

        res.json(coupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};"""

if old_validate in content:
    content = content.replace(old_validate, new_validate)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated homeController.js")
else:
    print("Could not find validateCoupon in homeController.js")
