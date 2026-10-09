/**
 * The shop page tags each service with where it is offered — Home Visit,
 * Shop Visit, 24x7 — as the partner ticked it. Home Visit was filtered out
 * entirely, so a service with Home Visit ticked showed only SHOP / 24X7.
 * It shows unless the partner has home visits switched off.
 *
 *   node scripts/shopHomeVisitTagCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'ShopDetail.jsx'), 'utf8');
// Evaluate the tag helper as written.
const src = page.slice(page.indexOf('const serviceModeTags'), page.indexOf('const ShopDetail = () =>'));
const serviceModeTags = new Function(`${src}; return serviceModeTags;`)();
const labels = (types, on) => serviceModeTags(types, on).map(t => t.label);

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('Home Visit is shown when ticked (it was always left out)', () => {
    assert.deepStrictEqual(labels(['home', 'shop', '24x7'], true), ['Home Visit', 'Shop Visit', '24x7']);
    assert.deepStrictEqual(labels(['home'], true), ['Home Visit']);
});
check("not when the partner's home visits are off (checkout offers At Shop only)", () => {
    assert.deepStrictEqual(labels(['home', 'shop', '24x7'], false), ['Shop Visit', '24x7']);
});
check("the old 'both' value means home and shop", () => {
    assert.deepStrictEqual(labels(['both'], true), ['Home Visit', 'Shop Visit']);
});
check('the old filter that dropped home is gone', () => {
    assert.ok(!/t !== 'home'/.test(page));
});

console.log(`\n${passed} shop service tag checks passed.`);
