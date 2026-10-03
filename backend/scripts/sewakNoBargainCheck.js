/**
 * "sewak wale se bargain and save hatao — ye sirf partner me hoga".
 * The Bargain & Save offer box showed on Sewak checkouts too. Sewak work is a
 * fixed rate, so bargaining is a Local Expert (partner) feature only:
 *  - Checkout hides the section for a Sewak booking (known from the booking
 *    itself, or from the provider once loaded) and can never send an offer
 *    for one, even from a value typed before the provider details arrived;
 *  - createBooking rejects an offer on a Sewak booking, so it can't be
 *    forced through the API either.
 * Partner bookings are untouched.
 *
 *   node scripts/sewakNoBargainCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const checkout = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'Checkout.jsx'), 'utf8');
const booking = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'bookingController.js'), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

check('Checkout knows a booking is Sewak from the booking or the loaded provider', () => {
    assert.ok(/const isSewakBooking =\s*checkoutData\.requiredProviderCategory === "sewak" \|\|\s*providerDetails\?\.providerCategory === "sewak"/.test(checkout));
});
check('the Bargain & Save section only renders for non-Sewak bookings', () => {
    const at = checkout.indexOf('{/* Bargain & Save */}');
    assert.ok(/\{!isSewakBooking && \(\s*<section/.test(checkout.slice(at, at + 200)));
    assert.ok(/Bargain & Save/.test(checkout), 'it must still exist for partners');
});
check('a Sewak booking can never send an offer', () => {
    assert.ok(/const hasCustomOffer =\s*!isSewakBooking && /.test(checkout));
});
check('the server rejects an offer on a Sewak booking, by request or by provider', () => {
    assert.ok(/hasOffer && requiredProviderCategory === 'sewak'/.test(booking));
    assert.ok(/hasOffer && specificProvider\.providerCategory === 'sewak'/.test(booking));
    assert.ok(/Bargaining is not available for Sewak bookings/.test(booking));
});
console.log(`\n${passed} sewak-no-bargain checks passed.\n`);
