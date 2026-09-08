/**
 * Reproduces the reported bug — a service deleted by the admin kept showing to
 * customers, partners and Sewaks — and proves the cascade fixes it.
 *
 * Point COIN_TEST_URI at a THROWAWAY database; it is dropped on entry and exit
 * and refuses to run against the application's own MONGODB_URI.
 *
 *   COIN_TEST_URI="mongodb://127.0.0.1:27018/svc_cascade_test?directConnection=true" \
 *     node scripts/serviceDeleteCascadeCheck.js
 */
const mongoose = require('mongoose');
const assert = require('assert');

const URI = process.env.COIN_TEST_URI;
if (!URI) {
    console.error('Set COIN_TEST_URI to a throwaway database.');
    process.exit(1);
}
require('dotenv').config();
if (process.env.MONGODB_URI && URI === process.env.MONGODB_URI) {
    console.error('Refusing to run against the application database.');
    process.exit(1);
}

const Service = require('../models/Service');
const Category = require('../models/Category');
const Combo = require('../models/Combo');
const Provider = require('../models/Provider');
const ServiceCatalogService = require('../services/ServiceCatalogService');

let passed = 0;
const check = async (label, fn) => { await fn(); passed += 1; console.log(`  ok  ${label}`); };

let seq = 0;
const makeProvider = async (category, overrides = {}) => {
    seq += 1;
    return await Provider.create({
        ownerName: `P${seq}`, shopName: `Shop ${seq}`,
        mobile: String(8800000000 + seq), password: 'x',
        vendorCode: `RSV${seq}${Date.now() % 100000}`,
        address: 'a', city: 'Indore', state: 'MP',
        vendorType: category._id, status: 'verified',
        ...overrides
    });
};

const run = async () => {
    await mongoose.connect(URI);
    await mongoose.connection.dropDatabase();

    // ---- Arrange: a catalog service copied everywhere it gets copied ----
    const category = await Category.create({ name: 'Cleaning' });
    const otherCategory = await Category.create({ name: 'Plumbing' });

    const catalogService = await Service.create({
        name: 'Deep Clean', price: 500, categoryId: category._id, visible: true
    });
    category.services.push({ _id: catalogService._id, name: 'Deep Clean', basePrice: 500 });
    category.services.push({ name: 'Sofa Clean', basePrice: 300 }); // entry with no _id
    await category.save();

    // A partner in the same category with their own copy (name-linked only,
    // and note it carries `category`, never `categoryId` — which is exactly
    // why the old delete query missed it).
    const partner = await makeProvider(category, { providerCategory: 'partner' });
    const partnerCopy = await Service.create({
        providerId: partner._id, name: 'Deep Clean', price: 600,
        category: 'Cleaning', visible: true
    });
    partner.subServices = ['Deep Clean', 'Sofa Clean'];
    await partner.save();

    // A Sewak whose selected services are stored as names.
    const sewak = await makeProvider(category, { providerCategory: 'sewak' });
    sewak.subServices = ['Deep Clean'];
    await sewak.save();

    // A provider in a DIFFERENT category with an identically named service,
    // which must survive untouched.
    const otherPartner = await makeProvider(otherCategory, { providerCategory: 'partner' });
    const otherCopy = await Service.create({
        providerId: otherPartner._id, name: 'Deep Clean', price: 700,
        category: 'Plumbing', visible: true
    });
    otherPartner.subServices = ['Deep Clean'];
    await otherPartner.save();

    // A combo bundling the service, plus one that only has this service in it.
    const keepAlive = await Service.create({ providerId: partner._id, name: 'Window Clean', price: 200 });
    const mixedCombo = await Combo.create({
        providerId: partner._id, name: 'Mixed', price: 800,
        services: [catalogService._id, keepAlive._id], isActive: true
    });
    const soloCombo = await Combo.create({
        providerId: partner._id, name: 'Solo', price: 500,
        services: [catalogService._id], isActive: true
    });

    console.log('\nBefore deletion the service is visible everywhere');
    await check('partner has their own copy, and it is what customers see', async () => {
        const visibleToCustomers = await Service.find({ providerId: partner._id, visible: true });
        assert.ok(visibleToCustomers.some(s => s.name === 'Deep Clean'));
    });

    // ---- Act ----
    await Service.findByIdAndDelete(catalogService._id);
    const summary = await ServiceCatalogService.cascadeServiceRemoval({
        serviceId: catalogService._id,
        serviceName: 'Deep Clean',
        categoryId: category._id
    });

    console.log('\nAfter deletion it is gone from every surface');
    await check('removed from the category catalog Sewak surfaces read', async () => {
        const cat = await Category.findById(category._id).lean();
        assert.ok(!cat.services.some(s => s.name === 'Deep Clean'));
        assert.strictEqual(summary.categoryEntriesRemoved, 1);
    });

    await check('an entry without an _id is NOT collateral damage', async () => {
        // The old filter dropped any entry lacking an _id.
        const cat = await Category.findById(category._id).lean();
        assert.ok(cat.services.some(s => s.name === 'Sofa Clean'), 'Sofa Clean should survive');
    });

    await check("the partner's own copy is deleted, so customers stop seeing it", async () => {
        assert.strictEqual(await Service.findById(partnerCopy._id), null);
        assert.strictEqual(summary.providerCopiesDeleted, 1);
    });

    await check('the partner no longer lists it among their selected services', async () => {
        const p = await Provider.findById(partner._id).lean();
        assert.ok(!p.subServices.includes('Deep Clean'));
        assert.ok(p.subServices.includes('Sofa Clean'), 'other selections untouched');
    });

    await check('the Sewak no longer lists it either', async () => {
        const s = await Provider.findById(sewak._id).lean();
        assert.ok(!s.subServices.includes('Deep Clean'));
    });

    console.log('\nBlast radius stays inside the category');
    await check('an identically named service in another industry survives', async () => {
        const survivor = await Service.findById(otherCopy._id);
        assert.ok(survivor, 'service in another category must not be deleted');
        const op = await Provider.findById(otherPartner._id).lean();
        assert.ok(op.subServices.includes('Deep Clean'), 'their selection must survive too');
    });

    console.log('\nCombos are repaired rather than left dangling');
    await check('the reference is pulled from combos', async () => {
        const mixed = await Combo.findById(mixedCombo._id).lean();
        assert.strictEqual(mixed.services.length, 1);
        assert.ok(!mixed.services.some(id => String(id) === String(catalogService._id)));
    });
    await check('a combo left empty is deactivated, not deleted', async () => {
        const solo = await Combo.findById(soloCombo._id).lean();
        assert.ok(solo, 'combo should still exist');
        assert.strictEqual(solo.services.length, 0);
        assert.strictEqual(solo.isActive, false);
    });
    await check('a combo that still has services stays active', async () => {
        const mixed = await Combo.findById(mixedCombo._id).lean();
        assert.strictEqual(mixed.isActive, true);
    });

    console.log('\nSafety when the category cannot be determined');
    await check('provider copies are skipped rather than guessed at', async () => {
        const orphan = await Service.create({
            providerId: otherPartner._id, name: 'Orphan Svc', price: 100, visible: true
        });
        const s = await ServiceCatalogService.cascadeServiceRemoval({
            serviceId: new mongoose.Types.ObjectId(),
            serviceName: 'Orphan Svc',
            categoryId: null
        });
        assert.strictEqual(s.providerCopiesSkipped, true);
        assert.strictEqual(s.providerCopiesDeleted, 0);
        assert.ok(await Service.findById(orphan._id), 'must not mass-delete by name alone');
    });

    console.log('\nRepeat deletion is harmless');
    await check('running the cascade again is a no-op', async () => {
        const again = await ServiceCatalogService.cascadeServiceRemoval({
            serviceId: catalogService._id, serviceName: 'Deep Clean', categoryId: category._id
        });
        assert.strictEqual(again.categoryEntriesRemoved, 0);
        assert.strictEqual(again.providerCopiesDeleted, 0);
    });

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log(`\n${passed} cascade checks passed.\n`);
};

run().catch(async (err) => {
    console.error('\nFAILED:', err.message);
    console.error(err.stack);
    try { await mongoose.disconnect(); } catch (_) { }
    process.exit(1);
});
