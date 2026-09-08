/**
 * Seeds a throwaway database with just enough to drive the RozSewa Coins flows
 * through the real UI: a customer, an admin, a referrer, and a coin balance.
 *
 * Refuses to run against the application's own MONGODB_URI.
 *
 *   COIN_TEST_URI="mongodb://127.0.0.1:27018/rozsewa_demo" node scripts/seedCoinDemo.js
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

const User = require('../models/User');
const Category = require('../models/Category');
const CoinService = require('../services/CoinService');

const run = async () => {
    await mongoose.connect(URI);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map(n => mongoose.model(n).syncIndexes()));

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
            location: { type: 'Point', coordinates: [75.8577, 22.7196] }
        }],
        location: { type: 'Point', coordinates: [75.8577, 22.7196] }
    });

    const admin = await User.create({
        name: 'Demo Admin',
        email: 'admin@demo.test',
        mobile: '9000000002',
        password: 'demo1234',
        role: 'admin',
        isVerified: true
    });

    // A second customer holding a referral code, so the "apply a friend's code"
    // path has something real to resolve against.
    const referrer = await User.create({
        name: 'Demo Referrer',
        email: 'referrer@demo.test',
        mobile: '9000000003',
        password: 'demo1234',
        role: 'customer',
        referralCode: 'FRIEND123',
        isVerified: true
    });

    // A category so the checkout picks up a real GST / platform fee.
    await Category.create({
        name: 'Home Services',
        gstPercent: 18,
        platformFee: 20
    });

    // 3,000 coins = Rs 300 — the exact wallet from the spec's worked example.
    await CoinService.credit({
        ownerId: customer._id,
        ownerType: 'customer',
        ownerModel: 'User',
        coins: 3000,
        source: 'ADMIN_ADJUSTMENT',
        description: 'Demo seed balance',
        reason: 'Seeded for end-to-end testing'
    });

    console.log('\nSeeded demo data:');
    console.log(`  customer   customer@demo.test / demo1234   (${customer._id}) - 3,000 coins`);
    console.log(`  admin      admin@demo.test / demo1234      (${admin._id})`);
    console.log(`  referrer   referrer@demo.test / demo1234   code FRIEND123`);
    console.log('');

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch (_) { }
    process.exit(1);
});
