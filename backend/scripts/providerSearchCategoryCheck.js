/**
 * Customer-reported bug: searching "pandit", "electrician", "barber" (or
 * any newly-added category) on the customer app's search returned nothing.
 * getPublicProviders' search branch only ever matched Provider.shopName/
 * ownerName and a provider's own personally-created Service.name/
 * description — the admin-defined Category catalog (Category.name and its
 * services[] sub-catalog) was never queried at all. So a category existing
 * and even having a verified provider under it was not enough; search only
 * worked if that provider happened to type the same word into their own
 * shop name or personal service.
 *
 * This pins that the search branch now also resolves matching Category ids
 * (by category name or by a sub-service name inside it) and includes any
 * verified provider whose vendorType is one of those categories — live,
 * not a hardcoded list, so a brand-new category is searchable immediately.
 *
 *   node scripts/providerSearchCategoryCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const controller = read('controllers/homeController.js');
const fn = sliceFn(controller, 'const getPublicProviders');

console.log('\ngetPublicProviders\' search now resolves matching categories, not just provider text');

check('a live regex query against Category.name and its services[].name, not a hardcoded/cached list', () => {
    assert.ok(/Category\.find\(\{ \$or: \[\{ name: searchRx \}, \{ 'services\.name': searchRx \}\] \}\)\.select/.test(fn),
        'a static whitelist would never pick up a category added after the code was written');
});

check('matching categories are joined onto the provider query by vendorType, alongside the existing shopName/ownerName/Service matches', () => {
    assert.ok(/const matchingCategoryIds = matchingCategories\.map\(c => c\._id\)/.test(fn));
    assert.ok(/\{ vendorType: \{ \$in: matchingCategoryIds \} \}/.test(fn));
    assert.ok(/\{ shopName: searchRx \}/.test(fn) && /\{ ownerName: searchRx \}/.test(fn) && /_id: \{ \$in: serviceProviderIds \}/.test(fn),
        'the fix should extend the existing matches, not replace them');
});

check('both lookups run together rather than one blocking the other', () => {
    assert.ok(/const \[matchingServices, matchingCategories\] = await Promise\.all\(/.test(fn));
});

console.log(`\n${passed} provider-search-category checks passed.\n`);
