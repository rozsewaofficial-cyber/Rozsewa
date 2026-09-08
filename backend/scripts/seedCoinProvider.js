/**
 * Adds a verified, online Partner to the demo database so the full booking
 * lifecycle (accept -> on the way -> start OTP -> completion OTP) can be driven
 * through the real UI, which is what triggers the coin commit and rewards.
 *
 * Refuses to run against the application's own MONGODB_URI.
 *
 *   COIN_TEST_URI="mongodb://127.0.0.1:27018/rozsewa_demo" node scripts/seedCoinProvider.js
 */
const mongoose = require('mongoose');

const URI = process.env.COIN_TEST_URI;
if (!URI) {
    console.error('Set COIN_TEST_URI to a throwaway database.');
    process.exit(1);
}
require('dotenv').config();
if (process.env.MONGODB_URI && URI === process.env.MONGODB_URI) {
    console.error('Refusing to seed the application database.');
    process.exit(1);
}

const Provider = require('../models/Provider');
const Category = require('../models/Category');
const { Wallet } = require('../models/Wallet');

const run = async () => {
    await mongoose.connect(URI);

    const category = await Category.findOne({ name: 'Home Services' });
    if (!category) throw new Error('Run seedCoinDemo.js first — no Home Services category found.');

    await Provider.deleteOne({ mobile: '9000000009' });

    const provider = await Provider.create({
        ownerName: 'Demo Partner',
        shopName: 'Demo Cleaning Co',
        mobile: '9000000009',
        password: 'demo1234',
        email: 'partner@demo.test',
        vendorCode: 'RSVND90009',
        vendorType: category._id,
        businessType: 'Individual',
        address: '5 Partner Lane, Indore',
        city: 'Indore',
        state: 'Madhya Pradesh',
        // Same coordinates as the demo customer, so radius dispatch always matches.
        location: { type: 'Point', coordinates: [75.8577, 22.7196] },
        status: 'verified',
        kycVerified: true,
        kycStatus: 'verified',
        isOnline: true,
        providerCategory: 'partner',
        serviceModes: ['home'],
        serviceRadius: 25,
        bankDetails: {
            accountNumber: '000111222333',
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank',
            accountHolderName: 'Demo Partner'
        }
    });

    await Wallet.deleteOne({ providerId: provider._id });
    await Wallet.create({ providerId: provider._id, balance: 0, availableBalance: 0 });

    console.log('\nSeeded provider:');
    console.log(`  partner  9000000009 / demo1234  (${provider._id})`);
    console.log(`  category ${category.name} (${category._id})`);
    console.log('');

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch (_) { }
    process.exit(1);
});
