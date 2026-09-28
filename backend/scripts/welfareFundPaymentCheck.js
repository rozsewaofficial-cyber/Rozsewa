/**
 * Two reported gaps in the RozSewa Welfare Fund feature, both genuinely
 * unbuilt rather than broken (confirmed with the user before building):
 *
 * 1. "Direct payment se payment nahi ho raha" — donating only ever debited
 *    wallet balance; there was no card/UPI path at all, so a customer with
 *    an empty wallet had no way to give.
 * 2. "Service book ke baad welfare fund total bill me add nahi ho raha" —
 *    Checkout.jsx had no welfare-fund concept whatsoever; nothing to add.
 *
 * These pin: the new Razorpay order/verify pair for a direct gift (mirroring
 * Tip's create-order/verify-signature pattern); the checkout-time
 * contribution riding on TOP of a booking's own payment via a dedicated
 * welfareFundAmount field kept deliberately OFF Booking.totalAmount (which
 * drives provider payout and platform commission elsewhere) — added back in
 * only when paymentController resolves what to actually charge; that it is
 * unavailable for cash ("after") bookings, since a provider must never
 * handle platform-bound money in cash; and that it's capped against abuse.
 *
 *   node scripts/welfareFundPaymentCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const model = read('models/WelfareFundContribution.js');
const controller = read('controllers/welfareFundController.js');
const routes = read('routes/welfareFundRoutes.js');
const bookingModel = read('models/Booking.js');
const bookingController = read('controllers/bookingController.js');
const paymentController = read('controllers/paymentController.js');
const welfareCardUi = feRead('modules/user/components/WelfareFundCard.jsx');
const checkoutUi = feRead('modules/user/pages/Checkout.jsx');

console.log('\nDirect (Razorpay) donation — a real payment gateway path, not just wallet debit');

check('the contribution record can carry payment-method/Razorpay audit fields', () => {
    assert.ok(/paymentMethod: \{[\s\S]{0,80}enum: \['wallet', 'razorpay'\]/.test(model));
    assert.ok(/razorpayOrderId: \{ type: String \}/.test(model) && /razorpayPaymentId: \{ type: String \}/.test(model));
});

check('createWelfareFundOrder creates a real Razorpay order for the chosen amount', () => {
    const fn = sliceFn(controller, 'const createWelfareFundOrder');
    assert.ok(/razorpay\.orders\.create\(\{/.test(fn));
    assert.ok(/amount: Math\.round\(amount \* 100\)/.test(fn));
});

check('verifyWelfareFundPayment checks the HMAC signature before logging anything, and never touches a wallet', () => {
    const fn = sliceFn(controller, 'const verifyWelfareFundPayment');
    assert.ok(/crypto\s*\n\s*\.createHmac\('sha256', process\.env\.RAZORPAY_KEY_SECRET\)/.test(fn));
    assert.ok(/razorpay_signature !== expectedSign/.test(fn));
    assert.ok(!/Wallet\.findOneAndUpdate/.test(fn), 'a direct gift never came out of the wallet, so nothing should debit one');
});

check('both new endpoints are routed and protected', () => {
    assert.ok(/router\.post\('\/order', protect, createWelfareFundOrder\)/.test(routes));
    assert.ok(/router\.post\('\/verify', protect, verifyWelfareFundPayment\)/.test(routes));
});

check('the Wallet-page card offers both payment methods, not just the wallet debit', () => {
    assert.ok(/Pay via Wallet/.test(welfareCardUi) && /Pay via UPI\/Card/.test(welfareCardUi));
    assert.ok(/API\.post\("\/welfare-fund\/order", \{ amount \}\)/.test(welfareCardUi));
});

console.log('\nCheckout-time contribution rides on top of the booking\'s own payment, off totalAmount');

check('welfareFundAmount is its own Booking field, separate from totalAmount', () => {
    assert.ok(/welfareFundAmount: \{\s*\n\s*type: Number,\s*\n\s*default: 0\s*\n\s*\}/.test(bookingModel));
});

check('createBooking stores it separately from finalTotalAmount, capped and cash-mode-blocked', () => {
    const fn = sliceFn(bookingController, 'const createBooking');
    assert.ok(/paymentMode === 'now' && requestedWelfareFundAmount > 0/.test(fn),
        'a provider collecting cash must never end up holding platform-bound money');
        assert.ok(/Math\.min\(requestedWelfareFundAmount, 500\)/.test(fn));
    assert.ok(/welfareFundAmount: safeWelfareFundAmount/.test(fn));
});

check("the Razorpay order for a booking's payment adds welfareFundAmount on top of totalAmount, not into it", () => {
    const fn = sliceFn(paymentController, 'const createOrder');
    assert.ok(/amount = Number\(booking\.totalAmount\) \+ Number\(booking\.welfareFundAmount \|\| 0\)/.test(fn));
});

check('a successful payment logs the contribution exactly once, tied to the booking', () => {
    const fn = sliceFn(paymentController, 'const verifyPayment');
    assert.ok(/booking\.welfareFundAmount > 0 && prevPaymentStatus !== 'paid'/.test(fn));
    assert.ok(/contributorType: 'customer'/.test(fn) && /bookingId: booking\._id/.test(fn));
});

console.log('\nThe checkout screen offers the toggle only where it can actually be honored');

check('the toggle only shows (and only ever contributes) when paying online, never for cash', () => {
    const fn = sliceFn(checkoutUi, 'const welfareFundAmount');
    assert.ok(/paymentMode === "now" && contributeWelfare/.test(fn));
    assert.ok(/paymentMode === "now" && \(/.test(checkoutUi) || /\{paymentMode === "now" && \(/.test(checkoutUi));
});

check('the displayed total includes it, and the booking payload carries it separately from totalAmount', () => {
    assert.ok(/const total = Math\.max\(0, grossTotal - coinDiscount\) \+ welfareFundAmount;/.test(checkoutUi));
    assert.ok(/totalAmount: total - welfareFundAmount,/.test(checkoutUi));
    assert.ok(/welfareFundAmount,/.test(checkoutUi));
});

console.log(`\n${passed} welfare-fund-payment checks passed.\n`);
