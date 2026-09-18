/**
 * Razorpay signs `order_id|payment_id` and nothing else.
 *
 * Not the amount, not what was bought, not who bought it. So a valid signature
 * proves only that some payment against some order succeeded — and every one
 * of these endpoints once treated it as proof of whatever the request happened
 * to claim alongside it. A partner could ask for a paid plan and be given it,
 * a rupee could be paid and any sum credited, and one captured signature
 * settled any booking in the system, repeatedly.
 *
 * What these pin is the shape of the fix rather than its wording: the amount
 * and the purpose come off a stored order, the order is claimed exactly once,
 * and nothing accepts a payment the gateway never saw.
 *
 *   node scripts/paymentSecurityCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const controller = read('controllers/paymentController.js');
const routes = read('routes/paymentRoutes.js');
const model = read('models/PaymentOrder.js');

console.log('\nA payment is worth what its order was raised for');

check('the order is written down when it is created', () => {
    const fn = controller.slice(controller.indexOf('const createOrder'), controller.indexOf('// @desc    Verify Razorpay Payment'));
    assert.ok(/PaymentOrder\.create\(/.test(fn), 'createOrder records the order');
    assert.ok(/amount,/.test(fn), 'with the amount it was raised for');
});

check("a booking's price comes off the booking, not the caller", () => {
    const fn = controller.slice(controller.indexOf('const createOrder'), controller.indexOf('// @desc    Verify Razorpay Payment'));
    assert.ok(/amount = Number\(booking\.totalAmount\)/.test(fn),
        'the figure is read from the booking being paid for');
});

check('no endpoint credits an amount taken from the request', () => {
    // This is the whole bug in one line: `Number(req.body.amount)` after a
    // signature check that never covered the amount.
    for (const fname of ['verifyWalletRecharge', 'verifyUserWalletRecharge']) {
        const start = controller.indexOf(`const ${fname}`);
        assert.ok(start > -1, `${fname} exists`);
        const fn = controller.slice(start, start + 2000);
        assert.ok(/claim\.order\.amount/.test(fn), `${fname} credits the order's amount`);
        assert.ok(!/Number\(amount\)/.test(fn), `${fname} must not credit a requested amount`);
    }
});

console.log('\nA payment can only be spent once');

check('the order is claimed in a single atomic update', () => {
    assert.ok(/consumedBy: null/.test(model),
        'the match requires it to be unclaimed, so only one caller wins');
    assert.ok(/findOneAndUpdate/.test(model), 'claimed and read in one step');
    assert.ok(/unique: true/.test(model), 'and an order is only ever recorded once');
});

check('every verification goes through that claim', () => {
    const verifiers = [
        'verifyPayment', 'verifySubscriptionPayment', 'verifyWalletRecharge',
        'verifyUserWalletRecharge', 'verifyLeadPayment', 'verifyBazaarPayment'
    ];
    for (const fname of verifiers) {
        const start = controller.indexOf(`const ${fname}`);
        assert.ok(start > -1, `${fname} exists`);
        assert.ok(/claimPayment\(req/.test(controller.slice(start, start + 900)),
            `${fname} claims the order`);
    }
});

check('a booking is settled only by its own payment', () => {
    const fn = controller.slice(controller.indexOf('const verifyPayment'), controller.indexOf('// @desc    Verify Razorpay Payment for Subscription'));
    assert.ok(/claim\.order\.bookingId/.test(fn),
        'the order must name the booking it settles');
});

console.log('\nNothing accepts a payment the gateway never saw');

check('simulated payments need the environment to allow them', () => {
    assert.ok(/ALLOW_SIMULATED_PAYMENTS === 'true'/.test(controller),
        'the switch is an environment variable, not a request field');
    // Every place that honours `isSimulated` has to consult it.
    const branches = controller.split("isSimulated || ").length - 1;
    const guards = controller.split('SIMULATED_PAYMENTS_ALLOWED').length - 1;
    assert.ok(guards >= branches + 1,
        'each simulated branch is guarded, and the flag is defined once');
});

check('there is no fallback signing key', () => {
    // `process.env.RAZORPAY_KEY_SECRET || "secret"` meant that with the secret
    // missing, every signature was checked against a word printed in this file.
    assert.ok(!/RAZORPAY_KEY_SECRET \|\|/.test(controller),
        'a missing secret must fail payments, not sign them with a default');
    assert.ok(/refusing to verify any payment/i.test(controller),
        'and it says so rather than failing quietly');
});

check('signatures are compared without leaking where they differ', () => {
    assert.ok(/timingSafeEqual/.test(controller), 'compared in constant time');
    assert.ok(controller.split('createHmac').length - 1 === 1,
        'and in exactly one place, so no endpoint rolls its own');
});

console.log('\nWho the payment belongs to');

check('an order raised while signed in cannot be claimed by anyone else', () => {
    assert.ok(/belongs to another account/.test(controller), 'ownership is checked');
    assert.ok(/noteWhoIfSignedIn/.test(routes),
        'and the order records its owner when one is known');
});

console.log('\nIdentity lookups');

check('the ones only staff use need a session', () => {
    const verifyRoutes = read('routes/verifyRoutes.js');
    for (const p of ['/criminal_verification', '/driving_licence']) {
        assert.ok(new RegExp(`'${p}', protect`).test(verifyRoutes), `${p} is behind protect`);
    }
    // The rest are reachable during registration, before an account exists,
    // but not without limit.
    for (const p of ['/bank', '/pan', '/gst', '/okyc/initiate', '/okyc/verify']) {
        assert.ok(new RegExp(`'${p}', signedInOrRationed`).test(verifyRoutes),
            `${p} is signed in or rationed`);
    }
    assert.ok(/429/.test(verifyRoutes), 'and a flood is answered with Too Many Requests');
});

console.log('\nSpending a balance');

check('a balance is checked and debited in one update', () => {
    // Reading a balance, deciding, then writing it back lets requests sent
    // together each pass the same check. Five against a wallet of 100 all
    // succeeded, and 500 left it.
    const welfare = read('controllers/welfareFundController.js');
    assert.ok(/balance: \{ \$gte: amount \}/.test(welfare), 'the match carries the check');
    assert.ok(/\$inc: \{ balance: -amount \}/.test(welfare), 'and the update does the debit');
    assert.ok(!/wallet\.balance -= amount/.test(welfare), 'never read-modify-write');

    const withdrawal = read('controllers/withdrawalController.js');
    assert.ok(/availableBalance: \{ \$gte: amount \}/.test(withdrawal),
        'a payout is held the same way');
    assert.ok(!/wallet\.availableBalance -= amount/.test(withdrawal), 'never read-modify-write');
});

console.log(`\n${passed} payment-security checks passed.\n`);
