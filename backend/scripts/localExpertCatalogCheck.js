/**
 * Customer -> Local Expert category pages list the admin catalog only.
 *
 * The listing read every visible Service doc in the category, which included
 * each partner's own copies and the custom services partners typed in
 * themselves — their titles, descriptions and photos (one showed an ID card),
 * plus copies left behind by removed services and old partners.
 *
 *   node scripts/localExpertCatalogCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
const assert = require('assert');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Service = require('../models/Service');
const { getPublicServicesBySubcategory } = require('../controllers/subcategoryController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const id = () => new mongoose.Types.ObjectId();

const catId = id();
const partnerId = id();
const fanId = id();
const acId = id();
const category = { _id: catId, name: 'Electrician', services: [
    { _id: fanId, name: 'Fan Repair', basePrice: 0 },
    { _id: acId, name: 'AC Repair', basePrice: 0 },
] };
const rows = [
    { _id: id(), name: 'Switch Repair', categoryId: catId, category: 'Electrician', price: 0, visible: true, providerId: null },
    { _id: id(), name: 'Fan Repair', categoryId: catId, category: 'Electrician', price: 0, visible: false, providerId: null },
    { _id: id(), name: 'Dry Scalp Junk', category: 'Electrician', price: 100, visible: true, providerId: partnerId },
    { _id: id(), name: 'AC Repair', category: 'Electrician', price: 599, visible: true, providerId: partnerId },
];

// Minimal Mongo-ish matcher for the fields this listing filters on.
const matches = (doc, q) => Object.entries(q).every(([k, v]) => {
    if (k === '$or') return v.some(sub => matches(doc, sub));
    const val = doc[k];
    if (v === null) return val == null;
    if (v instanceof RegExp) return v.test(val || '');
    if (v && typeof v === 'object' && !(v instanceof mongoose.Types.ObjectId)) {
        if ('$regex' in v) return new RegExp(v.$regex).test(val || '');
        if ('$in' in v) return v.$in.some(x => String(x) === String(val));
        if ('$gt' in v) return Number(val) > v.$gt;
        if ('$ne' in v) return val !== v.$ne;
    }
    return String(val) === String(v);
});

Category.findById = async () => category;
Subcategory.find = async () => [];
Service.find = (q) => ({ sort: async () => rows.filter(r => matches(r, q)).map(r => ({ ...r })) });
Service.distinct = async (field, q) => [...new Set(rows.filter(r => matches(r, q)).map(r => r[field]))];

const list = () => new Promise((resolve, reject) => {
    const res = { status() { return this; }, json: resolve };
    getPublicServicesBySubcategory({
        params: { subcategoryId: 'all' },
        query: { categoryId: String(catId), category: 'Electrician', includeZeroPrice: 'true' }
    }, res).catch(reject);
});

(async () => {
    const names = (await list()).map(s => s.name).sort();

    await check('a partner\'s custom service is not in the customer catalog', async () => {
        assert.ok(!names.includes('Dry Scalp Junk'), names.join(', '));
    });
    await check('catalog rows and the category\'s own list both show, once each', async () => {
        assert.deepStrictEqual(names, ['AC Repair', 'Switch Repair']);
    });
    await check('a catalog service the admin hid stays hidden', async () => {
        assert.ok(!names.includes('Fan Repair'));
    });
    await check('partner copies are never the listed row', async () => {
        const out = await list();
        assert.ok(out.every(s => !s.providerId));
        assert.strictEqual(String(out.find(s => s.name === 'AC Repair')._id), String(acId));
    });

    console.log(`\n${passed} local-expert-catalog checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
