const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, './.env') });

const Setting = require('./models/Setting');
const Service = require('./models/Service');
const Coupon = require('./models/Coupon');
const Booking = require('./models/Booking');
const Category = require('./models/Category');

// Replicate the exact controller validation logic for testing
async function runBargainingValidation({ userId, serviceId, couponCode, customerOffer, totalAmount, items = [] }) {
    // --- 1. Compute Trusted Subtotal ---
    let subtotal = 0;
    
    if (items && items.length > 0) {
        for (const item of items) {
            const itemId = item.id;
            const qty = Number(item.qty) || 1;
            let basePrice = 0;
            
            if (mongoose.Types.ObjectId.isValid(itemId)) {
                const service = await Service.findById(itemId);
                if (service) {
                    basePrice = service.price || 0;
                } else {
                    const category = await Category.findOne({
                        $or: [
                            { "services._id": itemId },
                            { "combos._id": itemId }
                        ]
                    });
                    if (category) {
                        const subSvc = category.services.id(itemId);
                        if (subSvc) {
                            basePrice = subSvc.basePrice || 0;
                        }
                    }
                }
            }
            subtotal += basePrice * qty;
        }
    } else {
        if (mongoose.Types.ObjectId.isValid(serviceId)) {
            const service = await Service.findById(serviceId);
            if (service) {
                subtotal = service.price || 0;
            }
        }
    }

    if (subtotal === 0) {
        subtotal = Number(totalAmount) || 0;
    }

    // --- 2. Calculate Coupon Discount ---
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
    }

    // --- 3. Calculate Bargain Discount ---
    const parsedCustomerOffer = customerOffer !== undefined && customerOffer !== null ? Number(customerOffer) : (subtotal - couponDiscount);
    const payableAmount = Math.max(0, parsedCustomerOffer);
    const bargainDiscount = Math.max(0, subtotal - couponDiscount - payableAmount);
    const totalDiscount = couponDiscount + bargainDiscount;

    // --- 4. Validate Maximum Discount Limit ---
    const limitConfig = await Setting.findOne({ key: 'max_bargain_discount_limit' });
    const limit = limitConfig && limitConfig.value !== undefined ? Number(limitConfig.value) : 20;

    const maxAllowedDiscount = Math.round(subtotal * (limit / 100));
    const minAllowedOfferAmount = Math.max(0, subtotal - maxAllowedDiscount);

    // Validate boundaries
    if (totalDiscount > maxAllowedDiscount || payableAmount < 0 || totalDiscount > subtotal || bargainDiscount < 0 || couponDiscount < 0) {
        console.warn(`[BARGAIN REJECTED] User ID: ${userId}, Subtotal: ${subtotal}, Customer Offer: ${customerOffer}, Coupon Code: ${couponCode}, Total Discount: ${totalDiscount}, Configured Limit: ${limit}%`);
        return {
            valid: false,
            message: 'Customer Offer is too low.',
            minAllowedOffer: minAllowedOfferAmount,
            maxDiscountLimit: limit,
            calculations: { subtotal, couponDiscount, bargainDiscount, totalDiscount, payableAmount }
        };
    }

    return {
        valid: true,
        calculations: { subtotal, couponDiscount, bargainDiscount, totalDiscount, payableAmount }
    };
}

async function startTests() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // Clean up settings/coupons/services for tests
        await Setting.deleteOne({ key: 'max_bargain_discount_limit' });
        await Coupon.deleteOne({ code: 'TESTCOUPON10' });
        await Service.deleteMany({ name: 'Test Bargain Service' });

        // Setup test data
        console.log('Seeding test data...');
        const service = await Service.create({
            providerId: new mongoose.Types.ObjectId(),
            name: 'Test Bargain Service',
            category: 'Beauty',
            price: 1000
        });

        const coupon = await Coupon.create({
            code: 'TESTCOUPON10',
            discount: '10%',
            expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
            isActive: true,
            minOrderAmount: 100
        });

        const userId = new mongoose.Types.ObjectId().toString();

        console.log('\n--- SCENARIO 1: Setting Limit to 20% ---');
        await Setting.create({ key: 'max_bargain_discount_limit', value: 20 });
        
        console.log('Test 1.1: Valid customerOffer within 20% limit (offer 850)');
        let res = await runBargainingValidation({
            userId,
            serviceId: service._id,
            customerOffer: 850,
            totalAmount: 850
        });
        console.log('Result 1.1 Valid:', res.valid);
        if (!res.valid) throw new Error('Test 1.1 failed');

        console.log('Test 1.2: Invalid customerOffer exceeding 20% limit (offer 750, min offer should be 800)');
        res = await runBargainingValidation({
            userId,
            serviceId: service._id,
            customerOffer: 750,
            totalAmount: 750
        });
        console.log('Result 1.2 Valid:', res.valid, 'Message:', res.message, 'Min Allowed Offer:', res.minAllowedOffer);
        if (res.valid || res.minAllowedOffer !== 800) throw new Error('Test 1.2 failed');

        console.log('\n--- SCENARIO 2: Setting Limit to 30% and applying 10% Coupon ---');
        await Setting.findOneAndUpdate({ key: 'max_bargain_discount_limit' }, { value: 30 });

        console.log('Test 2.1: Valid offer with coupon (subtotal 1000, coupon 10% = 100, offer 750 = bargain 150, total disc 250 <= 300)');
        res = await runBargainingValidation({
            userId,
            serviceId: service._id,
            couponCode: 'TESTCOUPON10',
            customerOffer: 750,
            totalAmount: 750
        });
        console.log('Result 2.1 Valid:', res.valid, 'Coupon Discount:', res.calculations.couponDiscount, 'Bargain Discount:', res.calculations.bargainDiscount);
        if (!res.valid || res.calculations.couponDiscount !== 100 || res.calculations.bargainDiscount !== 150) throw new Error('Test 2.1 failed');

        console.log('Test 2.2: Invalid offer with coupon (offer 650 = bargain 250, total disc 350 > 300)');
        res = await runBargainingValidation({
            userId,
            serviceId: service._id,
            couponCode: 'TESTCOUPON10',
            customerOffer: 650,
            totalAmount: 650
        });
        console.log('Result 2.2 Valid:', res.valid, 'Min Allowed Offer:', res.minAllowedOffer);
        if (res.valid || res.minAllowedOffer !== 700) throw new Error('Test 2.2 failed');

        console.log('\n--- SCENARIO 3: Negative bounds & safety check ---');
        console.log('Test 3.1: Negative offer (offer -100)');
        res = await runBargainingValidation({
            userId,
            serviceId: service._id,
            customerOffer: -100,
            totalAmount: 1000
        });
        console.log('Result 3.1 Valid:', res.valid);
        if (res.valid) throw new Error('Test 3.1 failed');

        console.log('\nAll validation test scenarios completed successfully!');

        // Clean up
        await Setting.deleteOne({ key: 'max_bargain_discount_limit' });
        await Coupon.deleteOne({ code: 'TESTCOUPON10' });
        await Service.deleteMany({ name: 'Test Bargain Service' });
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Test execution failed:', err);
        process.exit(1);
    }
}

startTests();
