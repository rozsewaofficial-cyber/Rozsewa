/**
 * Adds offer-able catalog items to the demo database, using the spec's own
 * worked example (a Rs 269 service that will be put on offer at Rs 109 = 59%).
 *
 * Refuses to run against the application's own MONGODB_URI.
 *
 *   COIN_TEST_URI="mongodb://127.0.0.1:27018/rozsewa_demo" node scripts/seedOfferDemo.js
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

const Service = require('../models/Service');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');

const run = async () => {
    await mongoose.connect(URI);
    await Promise.all(mongoose.modelNames().map(n => mongoose.model(n).syncIndexes()));

    const category = await Category.findOne({ name: 'Home Services' });
    if (!category) throw new Error('Run seedCoinDemo.js first — no Home Services category found.');

    let sub = await Subcategory.findOne({ name: 'Cleaning', categoryId: category._id });
    if (!sub) {
        sub = await Subcategory.create({
            name: 'Cleaning',
            categoryId: category._id,
            visible: true
        });
    }

    // Partner catalog target — the spec's example price.
    await Service.deleteOne({ name: 'Bathroom Cleaning' });
    const service = await Service.create({
        name: 'Bathroom Cleaning',
        description: 'Deep bathroom cleaning with eco-friendly products',
        price: 269,
        categoryId: category._id,
        subcategoryId: sub._id,
        category: category.name,
        subcategory: sub.name,
        duration: '60 min',
        visible: true,
        visibleTo: 'both'
    });

    // A second one, so the picker shows more than a single row.
    await Service.deleteOne({ name: 'Sofa Shampooing' });
    const service2 = await Service.create({
        name: 'Sofa Shampooing',
        description: 'Wet shampoo cleaning for fabric sofas',
        price: 899,
        categoryId: category._id,
        subcategoryId: sub._id,
        category: category.name,
        subcategory: sub.name,
        duration: '90 min',
        visible: true,
        visibleTo: 'both'
    });

    // Sewak catalog target — an entry embedded in Category.services[].
    const existing = (category.services || []).find(s => s.name === 'Kitchen Deep Clean');
    if (!existing) {
        category.services.push({ name: 'Kitchen Deep Clean', basePrice: 499, visibleTo: 'both' });
        category.markModified('services');
        await category.save();
    }
    const refreshed = await Category.findById(category._id).lean();
    const sewakSvc = (refreshed.services || []).find(s => s.name === 'Kitchen Deep Clean');

    console.log('\nSeeded offer targets:');
    console.log(`  [Partner] Bathroom Cleaning   Rs ${service.price}   serviceId=${service._id}`);
    console.log(`  [Partner] Sofa Shampooing     Rs ${service2.price}   serviceId=${service2._id}`);
    console.log(`  [Sewak]   Kitchen Deep Clean  Rs ${sewakSvc.basePrice}   subServiceId=${sewakSvc._id}`);
    console.log('');

    await mongoose.disconnect();
};

run().catch(async (err) => {
    console.error('Seed failed:', err.message);
    try { await mongoose.disconnect(); } catch (_) { }
    process.exit(1);
});
