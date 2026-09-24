/**
 * The admin Bazaar "All Ads" screen got a category → subcategory cascading
 * filter; the customer-facing browse screen (RojsewaBazaar.jsx) had a
 * category filter of its own already, but no matching subcategory drill-down
 * even though the same Category documents carry the same subCategories.
 *
 * These pin: getLiveAds accepts subCategory the same way getAllAdminAds does
 * (only alongside a category), and the browse screen fetches the full
 * category list (the one place that actually carries each category's
 * subcategories — the live-ad facets only distinct what happens to be in
 * stock) to drive a "Type" chip row that appears once a category is chosen
 * and resets whenever the category changes.
 *
 *   node scripts/bazaarLiveSubCategoryCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nexports.', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const controller = read('controllers/bazaarController.js');
const ui = feRead('modules/user/pages/RojsewaBazaar.jsx');

console.log('\nThe live-ads endpoint understands subcategory the same way the admin one does');

check('subCategory only narrows the query alongside a category', () => {
    const fn = sliceFn(controller, 'exports.getLiveAds');
    assert.ok(/if \(subCategory && category\) query\.subCategory = subCategory;/.test(fn));
});

console.log('\nThe browse screen offers a Type row once a category is picked');

check('the full category list (with subCategories) is fetched, not just the live-ad facets', () => {
    assert.ok(/api\.get\('\/bazaar\/categories'\)/.test(ui),
        'the facets endpoint only distincts categories actually in stock, not their subcategory lists');
});

check('the subcategory row is scoped to the selected category and derived from its own list', () => {
    assert.ok(/const activeSubCategories = categoryFilter/.test(ui));
    assert.ok(/categoryDetails\.find\(c => c\.name === categoryFilter\)\?\.subCategories/.test(ui));
});

check('picking a different category clears whatever subcategory was selected', () => {
    assert.ok(/setCategoryFilter\(''\); setSubCategoryFilter\(''\)/.test(ui),
        'clearing the category should not leave a stale subcategory still filtering');
    assert.ok(/setCategoryFilter\(cat === categoryFilter \? '' : cat\); setSubCategoryFilter\(''\)/.test(ui),
        'switching categories should not leave the old category\'s subcategory selected');
});

check('the selected subcategory is actually sent to the live-ads request', () => {
    const fn = sliceFn(ui, 'const fetchBazaarItems');
    assert.ok(/categoryFilter && subCategoryFilter \? \{ subCategory: subCategoryFilter \} : \{\}/.test(fn));
});

console.log(`\n${passed} bazaar-live-subcategory checks passed.\n`);
