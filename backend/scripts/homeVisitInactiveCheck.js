/**
 * Report: a provider switched Home Visit to INACTIVE in their settings, but
 * customers still saw/selected Home Visit for that provider.
 *
 * Root cause: getPublicProviderById never selected isHomeVisitAvailable, so
 * Checkout's `providerDetails.isHomeVisitAvailable === false` check could
 * never be true (the field was always undefined). Checkout also defaults
 * serviceLocation to "home" and never moved off it.
 *
 *   node scripts/homeVisitInactiveCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const be = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const fe = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const home = be('controllers/homeController.js');
const booking = be('controllers/bookingController.js');
const checkout = fe('modules/user/pages/Checkout.jsx');
const shop = fe('modules/user/pages/ShopDetail.jsx');

console.log('\nThe flag reaches the customer app');

check('public provider endpoint returns isHomeVisitAvailable', () => {
    const fn = home.slice(home.indexOf('const getPublicProviderById'), home.indexOf('const getPublicProviderById') + 700);
    assert.ok(/availability is24x7 isHomeVisitAvailable'\)/.test(fn));
});

console.log('\nCustomers cannot end up on Home Visit for an inactive provider');

check('Checkout starts on At-Shop when home visit is off', () => {
    assert.ok(/isHomeVisitAvailable === false\) \{\s*setServiceLocation\("shop"\)/.test(checkout));
});

check('ShopDetail hides the Home Visit tab when off', () => {
    assert.ok(/provider\.isHomeVisitAvailable && \(\s*<button onClick=\{\(\) => setServiceFilter\('home'\)\}/.test(shop));
});

check('createBooking rejects a home booking for an inactive provider', () => {
    assert.ok(/serviceLocation === 'home' && specificProvider\.providerCategory !== 'sewak' && specificProvider\.isHomeVisitAvailable === false/.test(booking));
});

console.log(`\n${passed} home-visit-inactive checks passed.\n`);
