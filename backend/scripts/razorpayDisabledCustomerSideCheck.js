/**
 * Customer side of the per-partner Razorpay switch (Provider.razorpayDisabled).
 * A customer booking a provider with online payment switched off must never
 * reach Razorpay: checkout hides "Pay Online", the backend refuses an online
 * booking, an online switch and an order for that provider's booking. The
 * checkout also had to stop quoting a ~Rs 43,000 travel charge the server no
 * longer bills (200 km sanity cap).
 *
 *   node scripts/razorpayDisabledCustomerSideCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const be = (r) => fs.readFileSync(path.join(__dirname, '..', r), 'utf8');
const fe = (r) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', r), 'utf8');
let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const booking = be('controllers/bookingController.js');
const payment = be('controllers/paymentController.js');
const home = be('controllers/homeController.js');
const checkout = fe('modules/user/pages/Checkout.jsx');

console.log('\nBackend refuses online payment for that provider');
check('createBooking rejects paymentMode "now" for a flagged provider', () => {
    assert.ok(/specificProvider\.razorpayDisabled && paymentMode === 'now'/.test(booking));
});
check('switching a booking to online is refused when its provider is flagged', () => {
    assert.ok(/req\.body\.paymentMode === 'now' && booking\.providerId[\s\S]{0,300}razorpayDisabled/.test(booking));
});
check('createOrder refuses to open Razorpay for a booking whose provider is flagged', () => {
    const fn = payment.slice(payment.indexOf('const createOrder'), payment.indexOf('// @desc    Verify Razorpay Payment'));
    const guard = fn.indexOf('payee?.razorpayDisabled');
    assert.ok(guard > -1);
    assert.ok(guard < fn.indexOf('razorpay.orders.create'));
});

console.log('\nCustomers see only a boolean');
check('the public provider endpoint exposes onlinePaymentDisabled and not the raw flag', () => {
    assert.ok(/providerData\.onlinePaymentDisabled = !!provider\.razorpayDisabled/.test(home));
    assert.ok(/delete providerData\.razorpayDisabled/.test(home));
});

console.log('\nCheckout');
check('Pay Online is hidden and Pay After Service forced when online payment is off', () => {
    assert.ok(/if \(pData\.onlinePaymentDisabled\) setPaymentMode\("after"\)/.test(checkout));
    assert.ok(/\{!providerDetails\?\.onlinePaymentDisabled && \(/.test(checkout));
});
check('checkout applies the same 200 km travel sanity cap as the server', () => {
    assert.ok(/travelDistanceKm > 200 \? null : travelDistanceKm/.test(checkout));
});

console.log(`\n${passed} razorpay-disabled customer-side checks passed.\n`);
