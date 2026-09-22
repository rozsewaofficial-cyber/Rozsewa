/**
 * Sewak Pricing Control let an admin set a service's Base Price only. The
 * request was for a second amount alongside it — a higher reference price,
 * treated like an "offer price" against the real (base) price — editable
 * from the same screen.
 *
 * Adding the field to the schema and the save path was not enough on its
 * own: getCategories (what the pricing screen's list actually reads) rebuilds
 * each service into a hand-picked object, and a field left out of that pick
 * comes back as `undefined` no matter what is stored in Mongo — the same
 * PROVIDER_LIST_FIELDS-shaped mistake hit earlier on the provider documents
 * screen, now on categories. These pin that offerPrice survives that rebuild
 * in both the embedded-service and standalone-Service branches of it, is
 * accepted on save, and has an editable field in the UI.
 *
 *   node scripts/sewakOfferPriceCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const model = read('models/Category.js');
const controller = read('controllers/adminController.js');
const ui = feRead('modules/admin/pages/SewakPricing.jsx');

console.log('\nThe field exists and round-trips through the list the screen reads');

check('the schema carries it on each service', () => {
    assert.ok(/offerPrice: \{ type: Number, default: 0 \}/.test(model));
});

check('getCategories keeps it for a service defined on the category itself', () => {
    const fn = controller.slice(controller.indexOf('const getCategories'), controller.indexOf('const addCategory'));
    const embeddedBlock = fn.slice(fn.indexOf('embeddedServices.forEach'), fn.indexOf('dbServices.forEach'));
    assert.ok(/offerPrice: Number\(s\.offerPrice\) \|\| 0/.test(embeddedBlock),
        'not dropped by the hand-picked rebuild, the same shape of bug that once stripped documents[] elsewhere');
});

check('getCategories keeps it for a service backed by a standalone Service doc too', () => {
    const fn = controller.slice(controller.indexOf('const getCategories'), controller.indexOf('const addCategory'));
    const dbBlock = fn.slice(fn.indexOf('dbServices.forEach'), fn.indexOf('return {\n                ...cat'));
    assert.ok(/offerPrice: existing\?\.offerPrice \|\| 0/.test(dbBlock),
        'carried over from the embedded copy since the standalone doc has nowhere to store it');
});

check('updateCategory accepts and persists it', () => {
    const fn = controller.slice(controller.indexOf('const updateCategory'), controller.indexOf('const deleteCategory'));
    assert.ok(/offerPrice: Number\(pick\('offerPrice', 0\)\) \|\| 0/.test(fn));
});

console.log('\nThe admin can actually set it from Sewak Pricing Control');

check('the edit drawer has an Offer Price input alongside the base rate', () => {
    assert.ok(/Offer Price \(₹\)/.test(ui), 'labeled field exists');
    assert.ok(/selectedService\.offerPrice/.test(ui), 'bound to the same selected service as the base rate');
});

check('saving with the drawer open merges offerPrice, not just basePrice', () => {
    const fn = ui.slice(ui.indexOf('const handleSaveCategoryPricing'), ui.indexOf('const handleSaveCategoryPricing') + 900);
    assert.ok(/offerPrice: Number\(selectedService\.offerPrice\) \|\| 0/.test(fn));
});

console.log(`\n${passed} sewak-offer-price checks passed.\n`);
