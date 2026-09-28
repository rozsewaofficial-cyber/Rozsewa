/**
 * Customer request: "search abhi category based hi kaam kar raha hai, usse
 * sub category aur services bhi banao" — search only ever matched category
 * names. Three separate gaps made that true even after earlier search fixes:
 *
 * 1. SearchBar's suggestion dropdown only fetched /public/categories, so
 *    typing an exact subcategory/service name (e.g. "Hair Care & Styling")
 *    showed no suggestion to tap at all.
 * 2. getPublicProviders' search never queried the standalone Subcategory
 *    collection, so even submitting that exact text found zero providers —
 *    a subcategory groups real services but isn't itself a Category or a
 *    Service.name.
 * 3. ShopListing.jsx re-filtered the backend's own (correct) results by
 *    provider name/category text alone, silently discarding any provider
 *    whose match came from a service or subcategory rather than their own
 *    shop name — this one alone made #2's fix look broken from the UI even
 *    once the API itself returned the right provider.
 *
 *   node scripts/searchSubcategoryServiceCheck.js
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
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

console.log('\nSearch suggestions cover subcategories and services, not just categories');

const bar = feRead('modules/user/components/SearchBar.jsx');
check('SearchBar asks the server for cross-catalog matches, debounced', () => {
    assert.ok(/API\.get\('\/public\/search-suggestions'/.test(bar));
    assert.ok(/setTimeout\(async \(\) => \{/.test(bar), 'debounced, not fired on every keystroke');
});

check('a subcategory/service suggestion in Sewak mode falls back to its parent category', () => {
    // ShopListing's Sewak branch only ever filters CategoryGrid by category
    // name — searching by the subcategory/service's own name there is a
    // guaranteed dead end regardless of what the backend can resolve.
    assert.ok(/mode === 'sewak' && m\.type !== 'category' && m\.categoryName/.test(bar));
});

console.log('\nThe backend can resolve a subcategory name to real providers');

const controller = read('controllers/homeController.js');

const suggestFn = sliceFn(controller, 'const getPublicSearchSuggestions');
check('getPublicSearchSuggestions queries Category, Subcategory AND Service together', () => {
    assert.ok(/Category\.find\(/.test(suggestFn) && /Subcategory\.find\(/.test(suggestFn) && /Service\.find\(/.test(suggestFn));
    assert.ok(/Promise\.all\(/.test(suggestFn), 'the three lookups run together');
});

const providersFn = sliceFn(controller, 'const getPublicProviders');
check('getPublicProviders resolves a matched Subcategory to its parent category', () => {
    assert.ok(/Subcategory\.find\(\{ name: searchRx \}\)\.select\('categoryId'\)/.test(providersFn),
        'a subcategory only exists as its own collection, unlike a category or a Service.name');
    assert.ok(/\.\.\.matchingSubcategories\.map\(s => s\.categoryId\)/.test(providersFn),
        'folded into the same matchingCategoryIds the vendorType filter already uses');
});

console.log('\nShopListing does not throw the backend\'s own results away');

const listing = feRead('modules/user/pages/ShopListing.jsx');
check('there is no second client-side re-filter on provider name/category text', () => {
    // That second filter matched only p.name/p.category — a provider whose
    // match came from a service or subcategory has neither string containing
    // the search text, so it was correctly fetched and then silently dropped.
    assert.ok(!/const pName = p\.name\.toLowerCase\(\)/.test(listing),
        'the backend search is already authoritative; re-filtering by name/category alone undoes it');
    assert.ok(/const sorted = \[\.\.\.allProvidersList\]\.sort/.test(listing),
        'sorting reads straight from what the API returned');
});

console.log(`\n${passed} search-subcategory-service checks passed.\n`);
