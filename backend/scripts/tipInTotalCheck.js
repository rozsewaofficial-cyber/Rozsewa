/**
 * The tip is part of the bill: chosen on the payment screen, added to
 * Total Payable, paid in the same payment (online) or the same cash.
 *
 * Also: Pay Online raised its order without the booking, which payment
 * verification refuses — the customer was charged and the booking not
 * marked paid; and a tip's own payment credited the amount the request
 * named, as often as it was sent.
 *
 *   node scripts/tipInTotalCheck.js
 *
 * Runs the real controllers with the models stubbed; nothing reaches
 * Razorpay or a database.
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
process.env.RAZORPAY_KEY_ID = 'rzp_test_check';
process.env.RAZORPAY_KEY_SECRET = 'check_secret';

const Booking = require('../models/Booking');
const PaymentOrder = require('../models/PaymentOrder');
const pay = require('../controllers/paymentController');
const tip = require('../controllers/tipController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const call = (fn, req) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn(req, res);
});
const sign = (o, p) => crypto.createHmac('sha256', 'check_secret').update(`${o}|${p}`).digest('hex');

let created = [];
pay.razorpay.orders.create = async (o) => ({ id: `order_${created.length + 1}`, amount: o.amount, currency: 'INR' });
PaymentOrder.create = async (d) => { created.push(d); return d; };
const booking = {
    _id: 'b1', userId: 'u1', providerId: 'p1', status: 'completed', totalAmount: 450, welfareFundAmount: 0,
    extraCharges: [{ item: 'Wire', amount: 100, status: 'approved' }, { item: 'Night Charge', amount: 50, status: 'approved' }, { item: 'Tape', amount: 30, status: 'pending' }]
};
Booking.findById = () => ({ select: async () => booking });
const customer = { _id: 'u1', role: 'customer' };
// The partner: looked up while pricing (online payment switched off?) and when crediting.
const Provider = require('../models/Provider');
const partnerDoc = { _id: 'p1', providerCategory: 'partner', save: async () => {} };
Provider.findById = () => ({ select: () => ({ lean: async () => ({ razorpayDisabled: false }) }), then: (ok, bad) => Promise.resolve(partnerDoc).then(ok, bad) });

(async () => {
    await check('the order is priced by the server: bill (+ approved extras) + the tip', async () => {
        created = [];
        const r = await call(pay.createOrder, { body: { bookingId: 'b1', purpose: 'booking', tipAmount: 50 }, user: customer });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(r.body.amount, (450 + 100 + 50) * 100, 'night charge already in the total; pending extra not counted');
        assert.strictEqual(created[0].bookingId, 'b1');
        assert.deepStrictEqual(created[0].meta, { tipAmount: 50 });
        assert.strictEqual(r.body.key, 'rzp_test_check');
    });

    await check('a tip must be a whole ₹1-10,000, from the customer, on a completed job', async () => {
        assert.strictEqual((await call(pay.createOrder, { body: { bookingId: 'b1', purpose: 'booking', tipAmount: 0.5 }, user: customer })).code, 400);
        assert.strictEqual((await call(pay.createOrder, { body: { bookingId: 'b1', purpose: 'booking', tipAmount: 20000 }, user: customer })).code, 400);
        assert.strictEqual((await call(pay.createOrder, { body: { bookingId: 'b1', purpose: 'booking', tipAmount: 50 }, user: { _id: 'x', role: 'customer' } })).code, 403);
        booking.status = 'started';
        assert.strictEqual((await call(pay.createOrder, { body: { bookingId: 'b1', purpose: 'booking', tipAmount: 50 }, user: customer })).code, 400);
        booking.status = 'completed';
    });

    await check("a tip's own payment credits what the order was for, once", async () => {
        let credited = [];
        const { Wallet, Transaction } = require('../models/Wallet');
        const Tip = require('../models/Tip');
        Booking.findById = async () => ({ ...booking, userId: { toString: () => 'u1' }, providerId: 'p1', serviceName: 'Fan' });
        Wallet.findOne = async () => ({ availableBalance: 0, save: async function () { credited.push(this.availableBalance); } });
        Transaction.create = async () => ({});
        Tip.create = async (d) => d;
        const order = { orderId: 'order_t', amount: 30, purpose: 'tip', userId: 'u1', meta: { bookingId: 'b1', tipAmount: 30 }, consumedBy: null };
        PaymentOrder.consume = async (id, p) => (id === 'order_t' && !order.consumedBy ? (order.consumedBy = p, order) : null);
        const body = { razorpay_order_id: 'order_t', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_t', 'pay_1'), bookingId: 'b1', amount: 99999, triggerPoint: 'post_payment' };
        const r = await call(tip.verifyTip, { body, user: customer });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(r.body.tip.amount, 30, 'not the 99999 in the request');
        assert.deepStrictEqual(credited, [30]);
        assert.strictEqual((await call(tip.verifyTip, { body, user: customer })).code, 409, 'replay refused');
    });

    await check('the payment screen: tip in Total Payable, both buttons, one booking-tied order', async () => {
        const page = read('frontend', 'src', 'modules', 'user', 'pages', 'PostService.jsx');
        assert.ok(/const payableNow = finalTotal \+ \(tipChoice \|\| 0\)/.test(page));
        assert.ok(/Pay Online ₹\{payableNow\}/.test(page) && /Confirm Cash Payment ₹\{payableNow\}/.test(page));
        assert.ok(/bookingId: booking\._id,\s*tipAmount: tipChoice \|\| undefined/.test(page), 'order tied to the booking, with the tip');
        assert.ok(/API\.post\("\/tips\/cash"/.test(page), 'a cash tip is recorded');
        assert.ok(/selectOnly/.test(page));
        const partner = read('frontend', 'src', 'modules', 'provider', 'components', 'RecentBookingsList.jsx');
        assert.ok(/req\.cashTip > 0/.test(partner) && /Collect in cash/.test(partner), "the partner's collection card asks for the cash tip");
        assert.ok(/Booking\.updateOne\(\{ _id: booking\._id \}, \{ \$set: \{ cashTip: tipAmount \} \}\)/.test(read('backend', 'controllers', 'tipController.js')));
        const verify = read('backend', 'controllers', 'paymentController.js');
        assert.ok(/claim\.order\.meta\?\.tipAmount > 0/.test(verify) && /creditTip\(/.test(verify), 'verify credits the tip paid with the bill');
    });

    await check('the bill adds up: the tip lines shown are inside the total', async () => {
        const page = read('frontend', 'src', 'modules', 'user', 'pages', 'PostService.jsx');
        assert.ok(/const billTotal = paymentDone \? finalTotal \+ onlineTipped \+ cashTipped : payableNow;/.test(page));
        assert.ok(/billTipLines\.map/.test(page) && /data-total-payable=\{billTotal\}/.test(page));
        assert.ok(/"Total Payable" : paidOnline \? "Total Paid" : "Total \(pay in cash\)"/.test(page));
        assert.ok(/active\.cashTip > 0\) setTipChoice/.test(page), 'a cash tip chosen earlier is the tip on the bill (not added twice)');
        const ctrl = read('backend', 'controllers', 'tipController.js');
        assert.ok(/res\.json\(\{ tips, totalTipped, onlineTipped, cashTipped \}\)/.test(ctrl));
        assert.ok(/tipAmount === 0/.test(ctrl) && /Tip\.deleteMany\(\{ bookingId: b\._id, status: 'cash' \}\)/.test(ctrl), '"No tip" takes a cash tip back');
    });

    console.log(`\n${passed} tip checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
