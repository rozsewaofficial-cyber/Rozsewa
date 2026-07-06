import os

file_path = r"d:\Rojsewa-main\backend\controllers\bookingController.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_logic = """        // --- 2. Calculate Coupon Discount ---
        let couponDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (coupon && new Date() <= coupon.expiryDate && coupon.usageCount < coupon.maxUsage && subtotal >= coupon.minOrderAmount) {
                if (coupon.discount.includes("%")) {
                    const percent = parseInt(coupon.discount);
                    couponDiscount = Math.round(subtotal * (percent / 100));
                } else {
                    couponDiscount = parseInt(coupon.discount.replace(/[^0-9]/g, "")) || 0;
                }
                if (coupon.maxDiscountAmount) {
                    couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
                }
                couponDiscount = Math.max(0, Math.min(couponDiscount, subtotal));
            }
        }"""

new_logic = """        // --- 2. Calculate Coupon Discount ---
        let couponDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true }).populate('targetCategory');
            if (coupon && new Date() <= coupon.expiryDate && coupon.usageCount < coupon.maxUsage && subtotal >= coupon.minOrderAmount) {
                
                let belongsToCategory = true;
                if (coupon.targetCategory && serviceId) {
                    belongsToCategory = false;
                    if (mongoose.Types.ObjectId.isValid(serviceId)) {
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
                    }
                }

                if (belongsToCategory) {
                    if (coupon.discount.includes("%")) {
                        const percent = parseInt(coupon.discount);
                        couponDiscount = Math.round(subtotal * (percent / 100));
                    } else {
                        couponDiscount = parseInt(coupon.discount.replace(/[^0-9]/g, "")) || 0;
                    }
                    if (coupon.maxDiscountAmount) {
                        couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
                    }
                    couponDiscount = Math.max(0, Math.min(couponDiscount, subtotal));
                    
                    // Increment usage count
                    coupon.usageCount += 1;
                    await coupon.save();
                } else {
                    console.warn(`[COUPON REJECTED] Coupon ${couponCode} is restricted to category ${coupon.targetCategory.name}, but serviceId ${serviceId} does not belong to it.`);
                }
            }
        }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated bookingController.js")
else:
    print("Could not find old_logic in bookingController.js")
