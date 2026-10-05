/**
 * Customer -> Sewak mode lists every bookable service of a category.
 *
 * Sewak screens read the copy embedded in Category.services, which drifted from
 * the admin catalog (standalone Service docs), and the category lookup's regex
 * escape never escaped anything. Services that partners could see were missing
 * for Sewak customers when:
 *   - the category name had "(", ")" or "+"      -> 404, no services at all
 *   - a catalog service never reached the copy   -> missing
 *   - the admin moved a service to a new category -> stuck in the old one
 *
 *   node scripts/sewakCategoryServicesCheck.js
 *
 * Runs the real controllers with the models stubbed; no database needed.
 */
const assert = require('assert');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Service = require('../models/Service');
const { getPublicCategoryByName } = require('../controllers/homeController');
const { updateAdminService } = require('../controllers/subcategoryController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const id = () => new mongoose.Types.ObjectId();
const res = () => {
    const r = { code: 200, body: undefined };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};

const catId = id();
const subId = id();
const embeddedId = id();
let categories;   // what Category.findOne can find
let catalog;      // standalone catalog Service docs
Category.findOne = async (q) => {
    const re = q.name.$regex;
    const c = categories.find(x => re.test(x.name));
    return c ? { toObject: () => JSON.parse(JSON.stringify(c)) } : null;
};
Service.find = () => ({ select: () => ({ lean: async () => catalog }) });

const page = async (name) => {
    const r = res();
    await getPublicCategoryByName({ params: { name } }, r);
    return r;
};
const names = (r) => (r.body.services || []).map(s => s.name);

(async () => {
    await check('a category named with ( ) and + is found', async () => {
        categories = [{ _id: catId, name: 'Cook + Maid (Daily)', services: [{ _id: embeddedId, name: 'Breakfast Cook', basePrice: 1500 }] }];
        catalog = [];
        const r = await page('Cook + Maid (Daily)');
        assert.strictEqual(r.code, 200, JSON.stringify(r.body));
        assert.deepStrictEqual(names(r), ['Breakfast Cook']);
        assert.strictEqual((await page('Cook  Maid (Daily)')).code, 404, 'a different name must not match');
    });

    await check('a catalog service missing from the embedded copy is listed, with its subcategory', async () => {
        const missingId = id();
        categories = [{ _id: catId, name: 'Maid', services: [{ _id: embeddedId, name: 'Sweeping', basePrice: 900 }] }];
        catalog = [
            { _id: embeddedId, name: 'Sweeping', price: 900, subcategoryId: subId, subcategory: 'Cleaning' },
            { _id: missingId, name: 'Utensil Washing', price: 1200, subcategoryId: subId, subcategory: 'Cleaning' }
        ];
        const r = await page('Maid');
        assert.deepStrictEqual(names(r), ['Sweeping', 'Utensil Washing']);
        const added = r.body.services.find(s => s.name === 'Utensil Washing');
        assert.strictEqual(added.basePrice, 1200);
        assert.strictEqual(String(added.subcategoryId), String(subId));
        assert.strictEqual(String(r.body.services[0].subcategoryId), String(subId), 'embedded rows get their subcategory too');
    });

    await check('an image uploaded on the catalog row shows even if the copy has none', async () => {
        categories = [{ _id: catId, name: 'Maid', services: [
            { _id: embeddedId, name: 'Sweeping', basePrice: 900 },
            { _id: id(), name: 'Mopping', basePrice: 900, image: 'own.png' }
        ] }];
        catalog = [{ _id: embeddedId, name: 'Sweeping', price: 900, image: 'catalog.png' }];
        const r = await page('Maid');
        assert.deepStrictEqual(r.body.services.map(s => s.image), ['catalog.png', 'own.png']);
    });

    await check('no duplicates when a catalog row is already embedded (by id or name)', async () => {
        categories = [{ _id: catId, name: 'Maid', services: [{ _id: embeddedId, name: 'Sweeping', basePrice: 900 }] }];
        catalog = [
            { _id: embeddedId, name: 'Sweeping', price: 900 },
            { _id: id(), name: ' sweeping ', price: 950 }
        ];
        assert.deepStrictEqual(names(await page('Maid')), ['Sweeping']);
    });

    await check('Partner-only, hidden and unpriced services stay out of Sewak mode', async () => {
        categories = [{ _id: catId, name: 'Cook', services: [
            { _id: id(), name: 'Embedded Partner Only', basePrice: 500, visibleTo: 'partner' },
            { _id: id(), name: 'Embedded Free', basePrice: 0 }
        ] }];
        catalog = [
            { _id: id(), name: 'Catalog Partner Only', price: 500, visibleTo: 'partner' },
            { _id: id(), name: 'Catalog Hidden', price: 500, visible: false },
            { _id: id(), name: 'Catalog Free', price: 0 },
            { _id: id(), name: 'Catalog Sewak', price: 700, visibleTo: 'sewak' }
        ];
        assert.deepStrictEqual(names(await page('Cook')), ['Catalog Sewak']);
    });

    // updateAdminService keeps the embedded copy in step with the catalog.
    const svcId = id();
    const oldCat = id();
    const newCat = id();
    let pulled;
    let target;
    Category.updateOne = async (filter, update) => { pulled = { filter, update }; };
    Category.findById = async () => target;
    const editService = async (doc, body) => {
        Service.findById = async () => doc;
        const r = res();
        await updateAdminService({ params: { id: String(svcId) }, body }, r);
        assert.strictEqual(r.code, 200, JSON.stringify(r.body));
    };
    const serviceDoc = (categoryId) => {
        const doc = { _id: svcId, name: 'Dinner Cook', price: 2000, categoryId, visibleTo: 'both' };
        doc.save = async () => doc;
        return doc;
    };
    const categoryDoc = (services) => ({ services, saved: false, markModified() {}, async save() { this.saved = true; } });

    await check('moving a service to another category pulls it from the old one and adds it to the new one', async () => {
        pulled = null;
        target = categoryDoc([]);
        await editService(serviceDoc(oldCat), { categoryId: String(newCat) });
        assert.strictEqual(String(pulled.filter._id), String(oldCat));
        assert.ok(pulled.update.$pull.services.$or.some(c => String(c._id) === String(svcId)));
        assert.strictEqual(target.services.length, 1);
        assert.strictEqual(target.services[0].name, 'Dinner Cook');
        assert.strictEqual(target.services[0].basePrice, 2000);
        assert.ok(target.saved);
    });

    await check('editing a service that is missing from its category\'s copy adds it back', async () => {
        pulled = null;
        target = categoryDoc([{ _id: id(), name: 'Other', basePrice: 100 }]);
        await editService(serviceDoc(oldCat), { price: 2100 });
        assert.strictEqual(pulled, null, 'same category: nothing is pulled');
        assert.deepStrictEqual(target.services.map(s => s.name), ['Other', 'Dinner Cook']);
        assert.strictEqual(target.services[1].basePrice, 2100);
    });

    await check('editing a service already in the copy updates it in place', async () => {
        target = categoryDoc([{ _id: svcId, name: 'Dinner Cook', basePrice: 2000 }]);
        await editService(serviceDoc(oldCat), { price: 2200 });
        assert.strictEqual(target.services.length, 1);
        assert.strictEqual(target.services[0].basePrice, 2200);
    });

    console.log(`\n${passed} sewak-category-services checks passed.\n`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
