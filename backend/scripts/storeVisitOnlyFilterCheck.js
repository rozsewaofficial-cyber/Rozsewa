/**
 * Customer request: the "Services" filter tab already had "Home Visit" and
 * "24/7 Services", but a provider who never turns Home Visit on (the
 * isHomeVisitAvailable default is false — see Provider.js) only serves
 * walk-ins at their shop. There was no way to filter for exactly those
 * providers, i.e. "Store Visit Only".
 *
 *   node scripts/storeVisitOnlyFilterCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const controller = read('controllers/homeController.js');
const page = feRead('modules/user/pages/ShopListing.jsx');

console.log('\nThe backend can filter for shop-only providers');

check('storeVisitOnly excludes anyone with home visit turned on, not just those explicitly set false', () => {
    const fn = controller.slice(controller.indexOf('const getPublicProviders'), controller.indexOf('const calculateDistance') === -1 ? controller.length : controller.indexOf('const calculateDistance'));
    assert.ok(/storeVisitOnly/.test(fn), 'the param is read from the query');
    assert.ok(/query\.isHomeVisitAvailable = \{ \$ne: true \}/.test(fn),
        'a legacy provider with the field unset must still count as store-visit-only, not be silently excluded');
});

console.log('\nThe Services filter tab offers it, right next to Home Visit');

check('the page has a Store Visit Only checkbox wired to its own state', () => {
    assert.ok(/const \[storeVisitOnly, setStoreVisitOnly\] = useState\(false\)/.test(page));
    assert.ok(/Store Visit Only/.test(page));
    assert.ok(/storeVisitOnly: storeVisitOnly \? "true" : ""/.test(page), 'and it reaches the API call');
});

check('checking one of Home Visit / Store Visit Only clears the other', () => {
    // A provider cannot be both "does home visits" and "shop only" at once —
    // letting both stay checked together would just return zero results
    // with no explanation.
    const homeVisitInput = page.split('\n').find(l => l.includes('checked={homeVisit}') && l.includes('onChange'));
    const storeVisitInput = page.split('\n').find(l => l.includes('checked={storeVisitOnly}') && l.includes('onChange'));
    assert.ok(/setStoreVisitOnly\(false\)/.test(homeVisitInput), 'turning Home Visit on turns Store Visit Only off');
    assert.ok(/setHomeVisit\(false\)/.test(storeVisitInput), 'and turning Store Visit Only on turns Home Visit off');
});

check('it counts toward the filter badge and clears with the rest', () => {
    const badgeLine = page.split('\n').find(l => l.includes('const activeFiltersCount ='));
    assert.ok(/storeVisitOnly \? 1 : 0/.test(badgeLine));
    const clearFn = page.slice(page.indexOf('const clearFilters'), page.indexOf('return (', page.indexOf('const clearFilters')));
    assert.ok(/setStoreVisitOnly\(false\)/.test(clearFn));
});

console.log(`\n${passed} store-visit-only filter checks passed.\n`);
