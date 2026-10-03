/**
 * Master-list item 2: a partner who ticked only some services still showed up
 * for every other service in the category. SubcategoryPage sends serviceId and
 * serviceName to /shops, but ShopListing dropped them and the API never filtered.
 *
 *   node scripts/serviceScopedListingCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const be = (r) => fs.readFileSync(path.join(__dirname, '..', r), 'utf8');
const fe = (r) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', r), 'utf8');
let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const page = fe('modules/user/pages/ShopListing.jsx');
check('ShopListing reads serviceId/serviceName from the URL and sends them to the API', () => {
    assert.ok(/searchParams\.get\("serviceId"\)/.test(page) && /searchParams\.get\("serviceName"\)/.test(page));
    assert.ok(/serviceId,\s*\n\s*serviceName,/.test(page));
    assert.ok(/\[category, serviceId, serviceName,/.test(page), 'changing the service must refetch');
});
const home = be('controllers/homeController.js');
check('the API only keeps partners who picked the service (id or name) or picked none', () => {
    assert.ok(/emergency, serviceId, serviceName \} = req\.query/.test(home));
    assert.ok(/subServices: \{ \$in: wanted \}/.test(home));
    assert.ok(/subServices: \{ \$size: 0 \}/.test(home), 'a partner who never chose services must not vanish');
});
console.log(`\n${passed} service-scoped-listing checks passed.\n`);
