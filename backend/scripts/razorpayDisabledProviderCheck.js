/**
 * Per-partner switch: Provider.razorpayDisabled. When it is true, POST
 * /api/payment/order (the one endpoint every partner-side Razorpay flow —
 * wallet recharge/clear dues, subscription, banner, lead unlock, kit — calls
 * before opening checkout) answers 403, so the checkout window never opens.
 * Customers and every other provider are untouched.
 *
 *   node scripts/razorpayDisabledProviderCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const model = read('models/Provider.js');
const controller = read('controllers/paymentController.js');
const fn = controller.slice(controller.indexOf('const createOrder'), controller.indexOf('// @desc    Verify Razorpay Payment'));

check('Provider has a razorpayDisabled flag that defaults to false', () => {
    assert.ok(/razorpayDisabled: \{ type: Boolean, default: false \}/.test(model));
});
check('createOrder refuses a flagged provider/sewak before any Razorpay order is created', () => {
    const guard = fn.indexOf('razorpayDisabled');
    assert.ok(guard > -1, 'the flag is checked');
    assert.ok(/req\.user\.role === 'provider' \|\| req\.user\.role === 'sewak'/.test(fn.slice(0, guard)));
    assert.ok(/status\(403\)/.test(fn.slice(guard, guard + 200)));
    assert.ok(guard < fn.indexOf('razorpay.orders.create'), 'the refusal must come before the order is created');
    assert.ok(guard < fn.indexOf('PaymentOrder.create'), 'and before anything is recorded');
});
check('customers are not affected: the guard only looks at provider/sewak accounts', () => {
    assert.ok(!/razorpayDisabled/.test(controller.replace(fn, '')), 'no other payment path reads the flag');
});

console.log(`\n${passed} razorpay-disabled-provider checks passed.\n`);
