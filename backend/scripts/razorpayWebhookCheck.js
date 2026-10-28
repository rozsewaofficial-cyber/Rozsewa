/**
 * Razorpay's signed webhook: only a correctly signed request is acted on,
 * a captured wallet payment is credited exactly once, and anything that does
 * not fit (wrong amount, other purpose, unknown order) is acknowledged and
 * left alone.
 *
 *   node scripts/razorpayWebhookCheck.js
 *
 * Runs the real controller with the models stubbed; nothing reaches
 * Razorpay or a database.
 */
const assert = require('assert');
const crypto = require('crypto');
require('mongoose').set('bufferCommands', false);
process.env.RAZORPAY_KEY_ID = 'rzp_test_check';
process.env.RAZORPAY_KEY_SECRET = 'check_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'hook_secret';

const PaymentOrder = require('../models/PaymentOrder');
const { Wallet, Transaction } = require('../models/Wallet');
const Provider = require('../models/Provider');
const InstaJob = require('../models/InstaJob');
const Settlement = require('../services/InstaSettlementService');
const { razorpayWebhook } = require('../controllers/paymentController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const sign = (raw, secret = 'hook_secret') => crypto.createHmac('sha256', secret).update(raw).digest('hex');
const send = (payload, { secret = 'hook_secret', raw = null, sig = null } = {}) => new Promise((resolve) => {
    const body = raw || Buffer.from(JSON.stringify(payload));
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    razorpayWebhook({ body, headers: { 'x-razorpay-signature': sig === null ? sign(body, secret) : sig } }, res);
});
const captured = (orderId, paymentId, rupees, method = 'upi') => ({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: Math.round(rupees * 100), method, status: 'captured' } } }
});

let orders, wallet, txs;
const reset = () => {
    orders = {
        order_w: { orderId: 'order_w', amount: 600.75, purpose: 'wallet', providerId: 'p1', consumedBy: null },
        order_b: { orderId: 'order_b', amount: 500, purpose: 'booking', providerId: 'p1', consumedBy: null }
    };
    wallet = { providerId: 'p1', balance: -600.75, cashCommissionDues: 0, save: async function () { return this; } };
    txs = [];
};
PaymentOrder.findOne = (q) => ({ lean: async () => orders[q.orderId] || null });
PaymentOrder.consume = async (orderId, paymentId) => {
    const o = orders[orderId];
    if (!o || o.consumedBy) return null;
    o.consumedBy = paymentId;
    return o;
};
PaymentOrder.updateOne = async () => ({});
Wallet.updateOne = async () => ({});
Wallet.findOne = () => ({ select: () => ({ lean: async () => ({ balance: wallet.balance }) }) });
Wallet.findOneAndUpdate = async (q, u) => { wallet.balance = Math.round((wallet.balance + u.$inc.balance) * 100) / 100; return wallet; };
Transaction.create = async (t) => { txs.push(t); return t; };
Provider.updateOne = async () => ({});

// Insta Work bills are settled from the job itself, by the order it raised.
let instaJobs, settled;
const instaJob = (over = {}) => ({
    razorpayOrderId: 'order_i', status: 'CUSTOMER_CONFIRMED', paymentMode: 'online', paymentStatus: 'pending', finalAmount: 100,
    jobCode: 'IWTEST', providerId: 'p1', customerId: 'c1', pushStatus() {}, async save() { return this; }, ...over
});
InstaJob.findOne = async (q) => instaJobs[q.razorpayOrderId] || null;
InstaJob.exists = async () => null;
Settlement.settle = async (job) => { settled.push(job.jobCode); return { ok: true }; };

(async () => {
    reset();
    instaJobs = {}; settled = [];

    await check('without a configured secret nothing is acted on', async () => {
        const keep = process.env.RAZORPAY_WEBHOOK_SECRET;
        delete process.env.RAZORPAY_WEBHOOK_SECRET;
        const r = await send(captured('order_w', 'pay_1', 600.75));
        process.env.RAZORPAY_WEBHOOK_SECRET = keep;
        assert.strictEqual(r.code, 503);
        assert.strictEqual(wallet.balance, -600.75);
    });

    await check('a bad or missing signature is refused and credits nothing', async () => {
        assert.strictEqual((await send(captured('order_w', 'pay_1', 600.75), { sig: 'deadbeef' })).code, 400);
        assert.strictEqual((await send(captured('order_w', 'pay_1', 600.75), { secret: 'someone_elses' })).code, 400);
        assert.strictEqual((await send(captured('order_w', 'pay_1', 600.75), { sig: '' })).code, 400);
        assert.strictEqual(wallet.balance, -600.75);
        assert.strictEqual(orders.order_w.consumedBy, null);
    });

    await check('a body that was already parsed (not raw bytes) is refused', async () => {
        const res = await new Promise((resolve) => {
            const r = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
            razorpayWebhook({ body: captured('order_w', 'pay_1', 600.75), headers: { 'x-razorpay-signature': 'x' } }, r);
        });
        assert.strictEqual(res.code, 400);
    });

    await check('a signed payment.captured credits the dues, once', async () => {
        const r = await send(captured('order_w', 'pay_1', 600.75));
        assert.strictEqual(r.code, 200);
        assert.strictEqual(wallet.balance, 0);
        assert.strictEqual(txs.length, 1);
        assert.strictEqual(txs[0].title, 'Debt Settlement');
        assert.strictEqual(txs[0].paymentMethod, 'UPI');
        // Razorpay retries, and the app may confirm too: still only once.
        await send(captured('order_w', 'pay_1', 600.75));
        await send({ ...captured('order_w', 'pay_1', 600.75), event: 'order.paid' });
        assert.strictEqual(wallet.balance, 0);
        assert.strictEqual(txs.length, 1);
    });

    await check('a payment for a different amount than the order is not credited', async () => {
        reset();
        const r = await send(captured('order_w', 'pay_2', 1));
        assert.strictEqual(r.code, 200);
        assert.strictEqual(wallet.balance, -600.75);
        assert.strictEqual(orders.order_w.consumedBy, null);
    });

    await check('other purposes, unknown orders and other events are acknowledged and ignored', async () => {
        reset();
        assert.strictEqual((await send(captured('order_b', 'pay_3', 500))).code, 200);
        assert.strictEqual(orders.order_b.consumedBy, null);
        assert.strictEqual((await send(captured('order_nope', 'pay_4', 10))).code, 200);
        assert.strictEqual((await send({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_5', order_id: 'order_w' } } } })).code, 200);
        assert.strictEqual((await send({ event: 'refund.processed', payload: {} })).code, 200);
        assert.strictEqual(wallet.balance, -600.75);
        assert.strictEqual(txs.length, 0);
    });

    await check('a captured Insta Work payment settles the job once, for the right amount only', async () => {
        instaJobs = { order_i: instaJob() }; settled = [];
        assert.strictEqual((await send(captured('order_i', 'pay_i1', 1))).code, 200);   // wrong amount
        assert.strictEqual(instaJobs.order_i.paymentStatus, 'pending');
        assert.strictEqual((await send(captured('order_i', 'pay_i1', 100))).code, 200);
        assert.strictEqual(instaJobs.order_i.paymentStatus, 'paid');
        assert.strictEqual(instaJobs.order_i.razorpayPaymentId, 'pay_i1');
        await send(captured('order_i', 'pay_i1', 100));                                 // Razorpay retries
        assert.deepStrictEqual(settled, ['IWTEST']);
    });

    await check('an Insta Work bill that is not awaiting payment is left alone', async () => {
        instaJobs = { order_i: instaJob({ status: 'WORK_STARTED' }) }; settled = [];
        await send(captured('order_i', 'pay_i2', 100));
        assert.strictEqual(instaJobs.order_i.paymentStatus, 'pending');
        assert.strictEqual(settled.length, 0);
    });

    await check('an unreadable payload is a 400, not a crash', async () => {
        const raw = Buffer.from('not json at all');
        assert.strictEqual((await send(null, { raw })).code, 400);
    });

    console.log(`\n${passed} razorpay webhook checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
