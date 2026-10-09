/**
 * A partner's combo says where it is done — Home Visit / Shop Visit / 24x7 —
 * like a single service. The combo form had no such choice, so every combo
 * could be booked At Home.
 *
 *   node scripts/comboServiceTypeCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

const model = read('backend', 'models', 'Combo.js');
const svc = read('backend', 'controllers', 'serviceController.js');
const booking = read('backend', 'controllers', 'bookingController.js');
const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx');
const shop = read('frontend', 'src', 'modules', 'user', 'pages', 'ShopDetail.jsx');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('a combo stores its service types (older combos: none, unrestricted)', () => {
    assert.ok(/serviceType: \{ type: \[String\], default: undefined \}/.test(model));
});
check('create and edit save the types, cleaned like a service\'s', () => {
    const create = svc.slice(svc.indexOf('const createCombo'), svc.indexOf('const updateCombo'));
    assert.ok(/serviceType: cleanServiceTypes\(req\.body\.serviceType\) \|\| \['home'\]/.test(create));
    const update = svc.slice(svc.indexOf('const updateCombo'), svc.indexOf('const deleteCombo'));
    assert.ok(/if \(cleanServiceTypes\(req\.body\.serviceType\)\) combo\.serviceType = cleanServiceTypes\(req\.body\.serviceType\);/.test(update));
});
check('the combo form asks for them with the same picker as the service form', () => {
    assert.ok(/const ServiceTypePicker = \(\{ value, onChange, layout = "col" \}\) =>/.test(page));
    assert.ok(/<ServiceTypePicker value=\{form\.serviceType\}/.test(page), 'service form');
    assert.ok(/<ServiceTypePicker layout="row" value=\{comboForm\.serviceType\}/.test(page), 'combo form');
    assert.ok(/serviceType: Array\.isArray\(c\.serviceType\) && c\.serviceType\.length \? c\.serviceType : \["home"\]/.test(page), 'editing keeps them');
    assert.ok(/if \(!comboForm\.serviceType \|\| comboForm\.serviceType\.length === 0\)/.test(page), 'at least one');
    assert.ok(/data-combo-types/.test(page), 'shown on the partner\'s combo card');
});
check('shop page: combo shows its tags, follows the filter, and carries its types to checkout', () => {
    assert.ok(/serviceType: combo\.serviceType \};/.test(shop), 'checkout gets the combo types (At Home rule)');
    assert.ok(/serviceModeTags\(combo\.serviceType, provider\?\.isHomeVisitAvailable !== false\)/.test(shop));
    assert.ok(/if \(!c\.serviceType\) return false;\s*if \(serviceFilter === '24x7' && provider\?\.is24x7\) return true;\s*return c\.serviceType\.includes\(serviceFilter\);/.test(shop));
});
check('booking a shop-only combo At Home is refused by the server', () => {
    assert.ok(/const shopOnlyCombo = await Combo\.findOne\(\{\s*_id: \{ \$in: ids \}, providerId: specificProvider\._id,\s*serviceType: \{ \$exists: true, \$ne: \[\], \$nin: \['home', 'both'\] \}/.test(booking));
    assert.ok(/is offered at the shop only\. Please choose At-Shop\./.test(booking.slice(booking.indexOf('const shopOnlyCombo'))));
});

console.log(`\n${passed} combo service type checks passed.`);
