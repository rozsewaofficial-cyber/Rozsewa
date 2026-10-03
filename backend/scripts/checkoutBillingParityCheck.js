/**
 * End-to-end test findings: checkout showed ₹714 but the stored booking was ₹600
 * with GST 0 (provider's own Service had category "nyka parlour", matching no
 * Category), shop-visit bookings said "Start Journey", and the checkout time
 * grid showed opening-time slots before any date was picked.
 *
 *   node scripts/checkoutBillingParityCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const be = (r) => fs.readFileSync(path.join(__dirname, '..', r), 'utf8');
const fe = (r) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', r), 'utf8');
let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const bc = be('controllers/bookingController.js');
check('fees fall back to the provider vendorType category when the service category matches none', () => {
    assert.ok(/!categoryForFee && providerId[\s\S]{0,200}Provider\.findById\(providerId\)\.select\('vendorType'\)[\s\S]{0,150}Category\.findById\(targetProvider\.vendorType\)/.test(bc));
    assert.ok(bc.indexOf('Category.findById(targetProvider.vendorType)') < bc.indexOf('appliedGstPercent = categoryForFee.gstPercent'));
});
check('shop-visit bookings do not say "Start Journey"', () => {
    const rb = fe('modules/provider/components/RecentBookingsList.jsx');
    assert.ok(/req\.serviceLocation === 'shop'\s*\?\s*\(isReady \? 'Customer Arriving/.test(rb));
});
check('no time slots are listed until a date is chosen', () => {
    const co = fe('modules/user/pages/Checkout.jsx');
    assert.ok(/\{!selectedDate \|\| availableSlots\.length === 0 \? \(/.test(co));
    assert.ok(/Select a date to see available time slots/.test(co));
});
console.log(`\n${passed} checkout-billing-parity checks passed.\n`);
