/**
 * The admin Bazaar "All Ads" screen had no way to narrow by category or
 * subcategory — only a free-text title search and a status dropdown — even
 * though every ad carries both fields and Categories already have named
 * subcategories configured for exactly this kind of drill-down.
 *
 * These pin: the backend endpoint accepts category and subCategory (the
 * latter only applied alongside a category, since a subcategory name is not
 * unique across categories), and the admin screen offers a category select
 * with a subcategory select cascading from it — mirroring the same pattern
 * the Chat Templates tab already uses for the same kind of scoped picker.
 *
 *   node scripts/bazaarAdCategoryFilterCheck.js
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
const ui = feRead('modules/admin/pages/AdminBazaar.jsx');

console.log('\nThe admin ads endpoint understands category and subcategory');

check('a category narrows the query', () => {
    const fn = sliceFn(controller, 'exports.getAllAdminAds');
    assert.ok(/if \(category\) query\.category = category;/.test(fn));
});

check('a subcategory only applies alongside a category', () => {
    const fn = sliceFn(controller, 'exports.getAllAdminAds');
    assert.ok(/if \(subCategory && category\) query\.subCategory = subCategory;/.test(fn),
        'a subcategory name is not unique across categories on its own');
});

console.log('\nThe All Ads screen offers a category, then a subcategory cascading from it');

check('a category select exists and clears the subcategory when changed', () => {
    const fn = sliceFn(ui, 'const AllAdsTab');
    assert.ok(/value=\{categoryFilter\}/.test(fn));
    assert.ok(/setCategoryFilter\(e\.target\.value\); setSubCategoryFilter\(''\)/.test(fn),
        'a leftover subcategory from a different category would silently filter out everything');
});

check('the subcategory select is disabled until a category is chosen, and reads that category\'s own list', () => {
    const fn = sliceFn(ui, 'const AllAdsTab');
    assert.ok(/disabled=\{!categoryFilter\}/.test(fn));
    assert.ok(/adCategories\.find\(c => c\.name === categoryFilter\)\?\.subCategories/.test(fn));
});

check('both filters are actually sent to the endpoint', () => {
    const fn = sliceFn(ui, 'const AllAdsTab');
    assert.ok(/params\.append\('category', categoryFilter\)/.test(fn));
    assert.ok(/params\.append\('subCategory', subCategoryFilter\)/.test(fn));
});

console.log(`\n${passed} bazaar-ad-filter checks passed.\n`);
