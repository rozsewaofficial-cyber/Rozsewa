/**
 * A partner can only add services from their own category.
 *
 * The app lists only the partner's category catalog, but the server took any
 * service name and any category name it was sent. It now accepts only a
 * service from the partner's own category (its list or its subcategories,
 * as visible to their kind of account), and saves that category.
 *
 *   node scripts/partnerOwnCategoryServicesCheck.js
 *
 * Runs the real controller with the models stubbed; no database.
 */
const assert = require('assert');
require('mongoose').set('bufferCommands', false);
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const Category = require('../models/Category');
const ctrl = require('../controllers/serviceController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const lean = (v) => ({ lean: async () => v });

Provider.findById = () => lean({ _id: 'p1', providerCategory: 'partner', vendorType: 'c1', subServices: [] });
// Subcategories of the category (none here).
require('../models/Subcategory').find = () => ({ select: () => ({ lean: async () => [] }) });
Category.findById = () => lean({ _id: 'c1', name: 'Salon & Grooming', services: [{ name: "Men's Haircut" }, { name: 'Bridal Makeup', visibleTo: 'sewak' }, { name: 'Threading' }] });
// Catalog rows (providerId null) and the partner's own services.
let mine = [];
Service.find = (q) => ({ select: () => ({ lean: async () => (q.providerId === null ? [
    { name: 'Face Cleanup', subcategory: 'Skin Care & Facials' },
    { name: 'Hair Spa', category: 'salon & grooming' },        // tied by category name only
    { name: 'Threading', visible: false }                      // hidden by admin
] : mine) }) });
let made;
Service.create = async (d) => { made = d; return { ...d, toObject() { return { ...d }; } }; };

const call = (fn, body, params = {}) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn({ body, params, user: { _id: 'p1', vendorType: 'c1' } }, res);
});
const base = { price: 200, duration: '30 min' };

(async () => {
    await check("a service from the partner's category is added, under that category", async () => {
        made = null;
        const r = await call(ctrl.createService, { ...base, name: "Men's Haircut", category: 'Electrician' });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(made.category, 'Salon & Grooming', 'not the category name sent');
    });

    await check("a subcategory service is accepted, with the catalog's subcategory", async () => {
        const r = await call(ctrl.createService, { ...base, name: 'Face Cleanup', subcategory: 'Something Else' });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(made.subcategory, 'Skin Care & Facials');
    });

    await check("a service from another category (or made up) is refused", async () => {
        made = null;
        for (const name of ['Geyser Repair', 'Anything I like']) {
            const r = await call(ctrl.createService, { ...base, name });
            assert.strictEqual(r.code, 400, name);
            assert.ok(/from your category/.test(r.body.message));
        }
        assert.strictEqual(made, null);
    });

    await check('a service the partner already offers is not added twice', async () => {
        mine = [{ name: "Men's Haircut" }];
        const r = await call(ctrl.createService, { ...base, name: "men's haircut" });
        assert.strictEqual(r.code, 409);
        mine = [];
    });

    await check('the same catalog the app lists: tied by name accepted, hidden by admin refused', async () => {
        assert.strictEqual((await call(ctrl.createService, { ...base, name: 'Hair Spa' })).code, 201);
        assert.strictEqual((await call(ctrl.createService, { ...base, name: 'Threading' })).code, 400);
    });

    await check("a catalog service meant only for Sewaks is refused to a partner", async () => {
        assert.strictEqual((await call(ctrl.createService, { ...base, name: 'Bridal Makeup' })).code, 400);
    });

    await check('renaming only to a service from the same category; editing otherwise is fine', async () => {
        const svc = { _id: 's1', providerId: 'p1', name: "Men's Haircut", price: 200, save: async function () { return this; } };
        Service.findById = async () => svc;
        assert.strictEqual((await call(ctrl.updateService, { name: 'Geyser Repair' }, { id: 's1' })).code, 400);
        assert.strictEqual(svc.name, "Men's Haircut");
        assert.strictEqual((await call(ctrl.updateService, { price: 250 }, { id: 's1' })).code, 200);
        assert.strictEqual(svc.price, 250);
    });

    await check('no category yet: nothing can be added', async () => {
        Provider.findById = () => lean({ _id: 'p1', providerCategory: 'partner', vendorType: null });
        const r = await call(ctrl.createService, { ...base, name: "Men's Haircut" });
        assert.strictEqual(r.code, 400);
    });

    console.log(`\n${passed} own-category service checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
