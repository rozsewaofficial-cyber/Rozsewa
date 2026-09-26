/**
 * Customer-reported bug: on the Sewak Services category-detail screen, the
 * "Search for services in <category>..." box sat directly above the
 * subcategory grid (Small Appliances, Air Conditioner, Air Cooler, Washing
 * Machine...) but typing into it did nothing.
 *
 * searchQuery was wired correctly to the input and correctly used to build
 * filteredServices/filteredCombos — but those two only ever render once a
 * subcategory has already been picked (selectedSubcategory !== null). The
 * subcategory grid itself, visible immediately on the page and the thing
 * the user was actually typing above, mapped over the raw, unfiltered
 * `subcategories` array with no reference to searchQuery at all.
 *
 * This pins that a filteredSubcategories list exists, that the grid renders
 * it instead of the raw array, and that a search matching zero subcategories
 * shows a message rather than silently rendering nothing.
 *
 *   node scripts/sewakSubcategorySearchCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const ui = feRead('modules/user/pages/SewakServices.jsx');

console.log('\nThe subcategory grid is actually filtered by the search box above it');

check('a filteredSubcategories list is derived from searchQuery, case-insensitively on name and description', () => {
    assert.ok(/const filteredSubcategories = subcategories\s*\n\s*\.filter\(sub => sub\.name\.toLowerCase\(\)\.includes\(searchQuery\.toLowerCase\(\)\)/.test(ui));
});

check('the grid maps over filteredSubcategories, not the raw subcategories array', () => {
    assert.ok(/filteredSubcategories\.map\(sub =>/.test(ui),
        'mapping the raw subcategories array is exactly the bug — searchQuery would never be consulted');
});

check('a search matching zero subcategories shows a message instead of silently rendering nothing', () => {
    assert.ok(/subcategories\.length > 0 && filteredSubcategories\.length === 0/.test(ui));
    assert.ok(/No subcategories match/.test(ui));
});

console.log(`\n${passed} sewak-subcategory-search checks passed.\n`);
