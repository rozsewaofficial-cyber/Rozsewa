/**
 * Adding a service: the partner's subcategory, service types, price and
 * duration are what gets saved.
 *
 * The Add Service form sent a subcategory and Home/Shop/24x7 choices that
 * the server silently dropped; a catalog service could be added at a fixed
 * ₹299 with "1 hour" without the partner entering anything; and the form had
 * no duration field. The catalog is now grouped by subcategory with photos,
 * and tapping a service opens the full form.
 *
 *   node scripts/partnerAddServiceCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const Category = require('../models/Category');
const { createService, updateService } = require('../controllers/serviceController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const lean = (v) => ({ lean: async () => v });
Provider.findById = () => lean({ _id: 'p1', providerCategory: 'partner', vendorType: 'c1' });
Category.findById = () => lean({ _id: 'c1', services: [] });
let created;
Service.create = async (doc) => { created = doc; return { ...doc, toObject() { return { ...doc }; } }; };

const call = (fn, body, params = {}) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn({ body, params, user: { _id: 'p1', vendorType: 'c1' } }, res);
});
const base = { name: 'Geyser Repair', price: 399, duration: '2 hours', category: 'Electrician' };

(async () => {
    await check('the subcategory and service types the partner picked are saved', async () => {
        const r = await call(createService, { ...base, subcategory: 'Appliance Repair', serviceType: ['home', 'shop', 'bogus'] });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(created.subcategory, 'Appliance Repair');
        assert.deepStrictEqual(created.serviceType, ['home', 'shop']);
        assert.strictEqual(created.duration, '2 hours');
        assert.strictEqual(created.price, 399);
    });

    await check('a price of zero, or above ₹1,00,000, is refused', async () => {
        assert.strictEqual((await call(createService, { ...base, price: 0 })).code, 400);
        assert.strictEqual((await call(createService, { ...base, price: 100001 })).code, 400);
    });

    await check('editing keeps the price cap and saves subcategory and types', async () => {
        const svc = { _id: 's1', providerId: 'p1', name: 'Geyser Repair', price: 399, serviceType: ['home'], save: async function () { return this; } };
        Service.findById = async () => svc;
        Service.findOne = async () => svc;
        const tooHigh = await call(updateService, { price: 500000 }, { id: 's1' });
        assert.strictEqual(tooHigh.code, 400);
        assert.strictEqual(svc.price, 399);
        await call(updateService, { price: 450, subcategory: 'Wiring', serviceType: ['24x7'] }, { id: 's1' });
        assert.strictEqual(svc.price, 450);
        assert.strictEqual(svc.subcategory, 'Wiring');
        assert.deepStrictEqual(svc.serviceType, ['24x7']);
    });

    await check('the Add Service screen: grouped catalog with photos, full form, no fixed amount', async () => {
        const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx'), 'utf8');
        assert.ok(/catalogGroups\.map/.test(page), 'catalog grouped by subcategory');
        assert.ok(/<ServiceVisual src=\{item\.image\}/.test(page), 'catalog cards show the service photo');
        assert.ok(/openServiceForm\(item\)/.test(page), 'tapping a service opens the form');
        assert.ok(!/handleQuickAdd/.test(page), 'no instant add');
        assert.ok(!/suggestion\.basePrice \|\| 299/.test(page), 'no ₹299 fallback on the catalog');
        assert.ok(/Time \/ Duration \*/.test(page), 'duration is asked');
        assert.ok(/newErrors\.duration/.test(page) && /newErrors\.subcategory/.test(page), 'duration and subcategory validated');
        assert.ok(/form\.image !== form\.catalogImage \? form\.image : \(selected\?\.image/.test(page), "another service brings its own photo, not the previous one's");
        assert.ok(/if \(editId\) \{\s*setForm\(\{ \.\.\.form, subcategory: e\.target\.value \}\)/.test(page), 'editing a subcategory keeps the service');
        assert.ok(/editId && form\.name \? \[\{ name: form\.name, label: form\.name === "custom" \? form\.customName/.test(page), 'the service being edited shows its name');
    });

    await check('the combo picker asks price and duration instead of adding at ₹299', async () => {
        const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx'), 'utf8');
        assert.ok(!/\|\| 299/.test(page), 'no ₹299 fallback anywhere');
        assert.ok(!/duration: "1 hour"/.test(page), 'no fixed duration');
        assert.ok(/const addPendingToCombo/.test(page) && /comboCatalog\.filter/.test(page));
    });

    await check("an older service without a subcategory gets the catalog's, once", async () => {
        const { getMyServices } = require('../controllers/serviceController');
        const Combo = require('../models/Combo');
        const old = { _id: 's9', name: 'switch board installation', price: 450 };
        const custom = { _id: 's10', name: 'My Own Thing', price: 100 };
        Provider.findById = () => ({ populate: async () => ({ _id: 'p1', providerCategory: 'partner', vendorType: { _id: 'c1', name: 'Electrician', services: [] } }) });
        Service.find = (q) => q.providerId === null
            ? { select: () => ({ lean: async () => [{ name: 'Switch Board Installation', subcategory: 'Wiring', subcategoryId: 'sub1' }] }) }
            : Promise.resolve([old, custom]);
        Combo.find = () => ({ populate: async () => [] });
        let ops;
        Service.bulkWrite = async (o) => { ops = o; };
        const r = await call(getMyServices, {});
        assert.strictEqual(r.code, 200, JSON.stringify(r.body));
        assert.strictEqual(old.subcategory, 'Wiring');
        assert.strictEqual(custom.subcategory, undefined);
        assert.strictEqual(ops.length, 1);
        assert.deepStrictEqual(ops[0].updateOne.update.$set, { subcategory: 'Wiring', subcategoryId: 'sub1' });
    });

    console.log(`\n${passed} add service checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
