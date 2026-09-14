/**
 * Seeds a throwaway database for an Insta Work end-to-end run: an admin, a
 * customer, and two live workers — one Sewak (auto-assigned) and one Partner
 * (customer-selected) — both pinging from the same area as the customer.
 *
 * Refuses to run against the application's own MONGODB_URI.
 *
 *   INSTA_TEST_URI="mongodb://127.0.0.1:27019/rozsewa_insta" node scripts/seedInstaDemo.js
 */
const mongoose = require('mongoose');

const URI = process.env.INSTA_TEST_URI;
if (!URI) {
    console.error('Set INSTA_TEST_URI to a throwaway database.');
    process.exit(1);
}
require('dotenv').config();
if (process.env.MONGODB_URI && URI === process.env.MONGODB_URI) {
    console.error('Refusing to seed the application database.');
    process.exit(1);
}

const User = require('../models/User');
const Provider = require('../models/Provider');
const Category = require('../models/Category');
const InstaService = require('../models/InstaService');
const { Wallet } = require('../models/Wallet');
const Service = require('../models/Service');

// Indore, so the customer and both workers are within matching range.
const LNG = 75.8577;
const LAT = 22.7196;

const run = async () => {
    await mongoose.connect(URI);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map(n => mongoose.model(n).syncIndexes()));

    // Category services matter for more than the catalogue: a Sewak with no
    // selected sub-services is held at the "choose your services" onboarding
    // gate and cannot reach any provider screen.
    const category = await Category.create({
        name: 'Home Services',
        gstPercent: 0,
        platformFee: 0,
        services: [
            { name: 'Bathroom Cleaning', basePrice: 150 },
            { name: 'Pickup & Delivery', basePrice: 100 }
        ]
    });
    const categoryServiceNames = (category.services || []).map(s => s.name);

    const customer = await User.create({
        name: 'Demo Customer',
        email: 'customer@demo.test',
        mobile: '9000000001',
        password: 'demo1234',
        role: 'customer',
        city: 'Indore',
        state: 'Madhya Pradesh',
        address: '12 Demo Street',
        isVerified: true,
        addresses: [{
            label: 'Home',
            address: '12 Demo Street, Indore',
            icon: 'home',
            location: { type: 'Point', coordinates: [LNG, LAT] }
        }],
        location: { type: 'Point', coordinates: [LNG, LAT] }
    });

    const admin = await User.create({
        name: 'Demo Admin',
        email: 'admin@demo.test',
        mobile: '9000000002',
        password: 'demo1234',
        role: 'admin',
        isVerified: true,
        // A role:'admin' with no permissions is bounced from every admin page
        // except the dashboard, so the seed grants what this demo drives.
        permissions: [
            '/admin/insta-work', '/admin/coins', '/admin/offer-management',
            '/admin/services', '/admin/bookings', '/admin/earnings',
            '/admin/users', '/admin/providers', '/admin/commission'
        ]
    });

    /** Both workers are created live, with a fresh ping so matching sees them. */
    const makeWorker = async ({ name, shop, mobile, code, providerCategory }) => {
        const p = await Provider.create({
            ownerName: name,
            shopName: shop,
            mobile,
            password: 'demo1234',
            email: `${code.toLowerCase()}@demo.test`,
            vendorCode: code,
            vendorType: category._id,
            businessType: 'Individual',
            address: '5 Worker Lane, Indore',
            city: 'Indore',
            state: 'Madhya Pradesh',
            location: { type: 'Point', coordinates: [LNG, LAT] },
            status: 'verified',
            kycVerified: true,
            kycStatus: 'verified',
            isOnline: true,
            providerCategory,
            serviceModes: ['home'],
            serviceRadius: 25,
            // Clears the Sewak onboarding gate.
            subServices: categoryServiceNames,
            bankDetails: {
                accountNumber: `0001112223${mobile.slice(-2)}`,
                ifscCode: 'HDFC0001234',
                bankName: 'HDFC Bank',
                accountHolderName: name
            }
        });
        await Wallet.create({ providerId: p._id, balance: 0, availableBalance: 0 });
        return p;
    };

    const sewak = await makeWorker({
        name: 'Demo Sewak', shop: 'Demo Sewak Services',
        mobile: '9000000007', code: 'RSVND90007', providerCategory: 'sewak'
    });
    const partner = await makeWorker({
        name: 'Demo Partner', shop: 'Demo Local Expert',
        mobile: '9000000009', code: 'RSVND90009', providerCategory: 'partner'
    });

    // The service from the spec: Bathroom Cleaning at Rs 150/hour, with the
    // Partner guardrail band of Rs 150-250.
    const cleaning = await InstaService.create({
        name: 'Bathroom Cleaning',
        description: 'Quick bathroom deep clean, charged by the hour',
        icon: 'Zap',
        categoryId: category._id,
        categoryName: category.name,
        pricingType: 'per_hour',
        sewakRate: 150,
        minRate: 150,
        maxRate: 250,
        minQuantity: 1,
        maxQuantity: 8,
        availableFor: ['sewak', 'partner'],
        isActive: true,
        createdBy: admin._id
    });

    // A per-km service with a base charge, to exercise the multi-pricing switch.
    const delivery = await InstaService.create({
        name: 'Pickup & Delivery',
        description: 'Local runner task, charged by distance',
        icon: 'Truck',
        categoryId: category._id,
        categoryName: category.name,
        pricingType: 'per_km',
        sewakRate: 15,
        minRate: 12,
        maxRate: 25,
        baseChargeEnabled: true,
        baseCharge: 30,
        minQuantity: 1,
        maxQuantity: 30,
        availableFor: ['sewak', 'partner'],
        isActive: true,
        createdBy: admin._id
    });

    // The remaining three pricing types, so all five are bookable in a demo
    // run rather than only the two from the spec worked example.
    const fencing = await InstaService.create({
        name: 'Fence Painting',
        description: 'Boundary painting, charged by the running meter',
        icon: 'Ruler',
        categoryId: category._id,
        categoryName: category.name,
        pricingType: 'per_meter',
        sewakRate: 40,
        minRate: 35,
        maxRate: 60,
        minQuantity: 1,
        maxQuantity: 200,
        availableFor: ['sewak', 'partner'],
        isActive: true,
        createdBy: admin._id
    });

    const fitting = await InstaService.create({
        name: 'Tap Fitting',
        description: 'Per-tap replacement, charged by the unit',
        icon: 'Wrench',
        categoryId: category._id,
        categoryName: category.name,
        pricingType: 'per_unit',
        sewakRate: 120,
        minRate: 100,
        maxRate: 180,
        baseChargeEnabled: true,
        baseCharge: 50,
        minQuantity: 1,
        maxQuantity: 20,
        availableFor: ['sewak', 'partner'],
        isActive: true,
        createdBy: admin._id
    });

    // Custom work is quoted on site, so it carries no quantity and no
    // meaningful estimate until the worker sets the final amount.
    const custom = await InstaService.create({
        name: 'Odd Jobs',
        description: 'Miscellaneous help, priced on site',
        icon: 'HelpCircle',
        categoryId: category._id,
        categoryName: category.name,
        pricingType: 'custom',
        sewakRate: 0,
        minRate: 0,
        maxRate: 5000,
        minQuantity: 1,
        maxQuantity: 1,
        availableFor: ['sewak', 'partner'],
        isActive: true,
        createdBy: admin._id
    });

    // A Partner is browsed and booked through their OWN catalogue, unlike a
    // Sewak who sells the category's services via subServices. A Partner with
    // no Service rows is skipped by the browse endpoint — rightly, since they
    // have listed nothing — so the demo Partner gets a real catalogue.
    await Service.insertMany([
        {
            providerId: partner._id,
            categoryId: category._id,
            category: category.name,
            name: 'Deep Home Cleaning',
            description: 'Full-home deep clean by a Local Expert',
            price: 899,
            duration: '3 hr',
            serviceType: ['home'],
            visible: true
        },
        {
            providerId: partner._id,
            categoryId: category._id,
            category: category.name,
            name: 'Sofa Shampooing',
            description: 'Per-sofa wet shampoo and dry',
            price: 499,
            duration: '1 hr 30 min',
            serviceType: ['home'],
            visible: true
        }
    ]);

    /** Puts a worker live on a service with a fresh GPS ping. */
    const goLive = async (provider, entries) => {
        provider.instaWork.enabled = true;
        provider.instaWork.services = entries;
        provider.instaWork.lastPingAt = new Date();
        provider.instaWork.lastPing = { type: 'Point', coordinates: [LNG, LAT] };
        await provider.save();
    };

    await goLive(sewak, [
        { serviceId: cleaning._id, serviceName: cleaning.name, rate: cleaning.sewakRate },
        { serviceId: delivery._id, serviceName: delivery.name, rate: delivery.sewakRate },
        { serviceId: fencing._id, serviceName: fencing.name, rate: fencing.sewakRate },
        { serviceId: fitting._id, serviceName: fitting.name, rate: fitting.sewakRate },
        { serviceId: custom._id, serviceName: custom.name, rate: custom.sewakRate }
    ]);
    await goLive(partner, [
        // Each rate sits inside that service's own guardrail band.
        { serviceId: cleaning._id, serviceName: cleaning.name, rate: 200 },
        { serviceId: delivery._id, serviceName: delivery.name, rate: 20 },
        { serviceId: fencing._id, serviceName: fencing.name, rate: 50 },
        { serviceId: fitting._id, serviceName: fitting.name, rate: 150 },
        { serviceId: custom._id, serviceName: custom.name, rate: 0 }
    ]);

    console.log('\nSeeded Insta Work demo:');
    console.log(`  admin     admin@demo.test / demo1234`);
    console.log(`  customer  9000000001 / demo1234        (${customer._id})`);
    console.log(`  sewak     9000000007 / demo1234  live @ Rs 150/hr   (${sewak._id})`);
    console.log(`  partner   9000000009 / demo1234  live @ Rs 200/hr   (${partner._id})`);
    console.log('            catalogue: Deep Home Cleaning Rs 899, Sofa Shampooing Rs 499');
    console.log(`  services  ${cleaning.name} (per hour @ ${cleaning.sewakRate})`);
    console.log(`            ${delivery.name} (per km @ ${delivery.sewakRate} + Rs ${delivery.baseCharge} base)`);
    console.log(`            ${fencing.name} (per meter @ ${fencing.sewakRate})`);
    console.log(`            ${fitting.name} (per unit @ ${fitting.sewakRate} + Rs ${fitting.baseCharge} base)`);
    console.log(`            ${custom.name} (custom, quoted on site)`);
    console.log('');

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch (_) { }
    process.exit(1);
});
