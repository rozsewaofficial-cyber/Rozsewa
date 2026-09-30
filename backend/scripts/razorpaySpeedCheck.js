/**
 * Customer complaint: "Razorpay bahut time le raha hai payment mein" —
 * payment felt slow. Two separate, unrelated causes, both on RozSewa's own
 * side (Razorpay itself was never the bottleneck):
 *
 * 1. Checkout.jsx's loadRazorpay() (and three other pages') unconditionally
 *    injected a brand-new <script src="checkout.razorpay.com/...">> and
 *    waited for it to load on every single "Pay Now" tap — even though
 *    index.html already loads that exact SDK eagerly at page boot, so
 *    window.Razorpay is normally already defined. Six OTHER call sites in
 *    the same codebase already had the one-line `if (window.Razorpay)
 *    resolve(true)` short-circuit; Checkout.jsx (the main booking payment
 *    screen), LiveTracking.jsx, PostService.jsx and Wallet.jsx did not.
 *
 * 2. paymentController.verifyPayment awaited notifyUser() twice before
 *    responding — each call chains a live FCM push, and the provider leg
 *    also an SMTP email send and an SMS gateway call. The money had
 *    already cleared; the customer was made to wait for that whole
 *    notification fan-out anyway.
 *
 *   node scripts/razorpaySpeedCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

console.log('\nEvery loadRazorpay() reuses the SDK index.html already loaded, instead of re-fetching it per payment');

for (const file of [
    'modules/user/pages/Checkout.jsx',
    'modules/user/pages/LiveTracking.jsx',
    'modules/user/pages/PostService.jsx',
    'modules/user/pages/Wallet.jsx',
]) {
    check(`${file} short-circuits when window.Razorpay is already present`, () => {
        const src = feRead(file);
        const idx = src.search(/const loadRazorpay(Script)? = /);
        assert.ok(idx !== -1, 'loadRazorpay must still exist here');
        const fn = src.slice(idx, idx + 400);
        assert.ok(/if \(window\.Razorpay\)/.test(fn),
            'without this, a script tag is injected and awaited on every payment attempt even when the SDK is already loaded');
    });
}

console.log('\nPayment verification responds as soon as the booking is actually settled, not after every notification channel finishes');

check('the customer and provider payment notifications are not awaited', () => {
    const controller = read('controllers/paymentController.js');
    const fn = controller.slice(controller.indexOf('const verifyPayment'), controller.indexOf('const verifySubscriptionPayment'));
    assert.ok(!/await notifyUser\(/.test(fn),
        'notifyUser chains a live FCM push (and, for the provider leg, an SMTP email and an SMS gateway call) — awaiting it holds the HTTP response hostage to those round-trips');
    assert.ok(/notifyUser\(\{[\s\S]*?\}\)\.catch\(/.test(fn),
        'fired without awaiting, but still caught so a notification failure cannot surface as an unhandled rejection');
});

console.log(`\n${passed} razorpay-speed checks passed.\n`);
