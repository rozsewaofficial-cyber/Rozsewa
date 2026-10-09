/**
 * Welfare Fund by Razorpay, for customers and partners: recorded as pending
 * when the order is made (at the server's amount), counted only once the
 * payment is verified, and marked cancelled / failed when the checkout does
 * not go through. The partner card offered the wallet only.
 *
 * Runs the real handlers with Razorpay and the database stubbed — nothing
 * leaves the machine.
 *
 *   node scripts/welfareRazorpayStatusCheck.js
 */
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'check_secret';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);

// Razorpay replaced before the controller loads it: no order reaches Razorpay.
const rzpPath = require.resolve('razorpay');
let orderSeq = 0;
require.cache[rzpPath] = { id: rzpPath, filename: rzpPath, loaded: true, exports: function Razorpay() {
    this.orders = { create: async ({ amount, currency }) => ({ id: `order_chk${++orderSeq}`, amount, currency }) };
    globalThis.__rzpInstance = this;
} };

const Provider = require('../models/Provider');
const WelfareFundContribution = require('../models/WelfareFundContribution');
const ctrl = require('../controllers/welfareFundController');

// In-memory contributions.
let rows = [];
const matches = (r, q) => Object.entries(q).every(([k, v]) => {
    if (v && typeof v === 'object' && '$ne' in v) return r[k] !== v.$ne;
    return String(r[k]) === String(v);
});
WelfareFundContribution.create = async (doc) => { const r = { _id: `w${rows.length + 1}`, ...doc }; rows.push(r); return r; };
WelfareFundContribution.findOneAndUpdate = async (q, upd) => {
    const r = rows.find(x => matches(x, q));
    if (!r) return null;
    Object.assign(r, upd.$set || {});
    for (const k of Object.keys(upd.$unset || {})) delete r[k];
    return r;
};
WelfareFundContribution.findOne = async (q) => rows.find(x => matches(x, q)) || null;
Provider.findById = async (id) => ({ _id: id, providerCategory: 'partner' });

const partner = { _id: 'p1', role: 'provider' };
const stranger = { _id: 'p2', role: 'provider' };
const call = async (fn, body, user = partner) => {
    let code = 200, payload;
    await fn({ body, user, query: {} }, { status(c) { code = c; return this; }, json(p) { payload = p; return this; } });
    return { code, body: payload };
};
const sign = (o, p) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${o}|${p}`).digest('hex');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

(async () => {
    let order;
    await check('the order is recorded as pending, at the amount the server fixed', async () => {
        const r = await call(ctrl.createWelfareFundOrder, { amount: 49.999 });
        order = r.body;
        assert.strictEqual(order.amount, 5000);
        assert.deepStrictEqual({ amount: rows[0].amount, status: rows[0].status, by: String(rows[0].providerId) }, { amount: 50, status: 'pending', by: 'p1' });
        assert.strictEqual((await call(ctrl.createWelfareFundOrder, { amount: 200000 })).code, 400);
    });
    await check('verified: paid at the recorded amount, whatever amount the app sends', async () => {
        const r = await call(ctrl.verifyWelfareFundPayment, { razorpay_order_id: order.id, razorpay_payment_id: 'pay_1', razorpay_signature: sign(order.id, 'pay_1'), amount: 10000 });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(r.body.contribution.amount, 50);
        assert.strictEqual(r.body.contribution.status, 'paid');
    });
    await check('submitted again: counted once', async () => {
        const r = await call(ctrl.verifyWelfareFundPayment, { razorpay_order_id: order.id, razorpay_payment_id: 'pay_1', razorpay_signature: sign(order.id, 'pay_1') });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(rows.filter(x => x.razorpayOrderId === order.id).length, 1);
    });
    await check('a wrong signature, or someone else\'s order, records nothing', async () => {
        assert.strictEqual((await call(ctrl.verifyWelfareFundPayment, { razorpay_order_id: order.id, razorpay_payment_id: 'x', razorpay_signature: 'bad' })).code, 400);
        const o2 = (await call(ctrl.createWelfareFundOrder, { amount: 20 })).body;
        assert.strictEqual((await call(ctrl.verifyWelfareFundPayment, { razorpay_order_id: o2.id, razorpay_payment_id: 'pay_2', razorpay_signature: sign(o2.id, 'pay_2') }, stranger)).code, 404);
        assert.strictEqual(rows.find(x => x.razorpayOrderId === o2.id).status, 'pending');
    });
    await check('checkout closed: cancelled; bank refused: failed; a paid gift is never undone', async () => {
        const o3 = (await call(ctrl.createWelfareFundOrder, { amount: 30 })).body;
        const o4 = (await call(ctrl.createWelfareFundOrder, { amount: 40 })).body;
        assert.strictEqual((await call(ctrl.closeWelfareFundPayment, { razorpay_order_id: o3.id, outcome: 'cancelled' })).code, 200);
        assert.strictEqual((await call(ctrl.closeWelfareFundPayment, { razorpay_order_id: o4.id, outcome: 'failed', reason: 'Card declined' })).code, 200);
        assert.strictEqual(rows.find(x => x.razorpayOrderId === o3.id).status, 'cancelled');
        assert.strictEqual(rows.find(x => x.razorpayOrderId === o4.id).status, 'failed');
        assert.strictEqual((await call(ctrl.closeWelfareFundPayment, { razorpay_order_id: order.id, outcome: 'cancelled' })).code, 404);
        assert.strictEqual(rows.find(x => x.razorpayOrderId === order.id).status, 'paid');
        assert.strictEqual((await call(ctrl.closeWelfareFundPayment, { razorpay_order_id: o3.id, outcome: 'refunded' })).code, 400);
    });

    await check('paid at Razorpay but never confirmed (app closed, UPI approved later, retry after a failure): marked paid on the next look', async () => {
        const now = Date.now();
        const old = new Date(now - 5 * 60 * 1000);
        rows = [
            { _id: 'a', providerId: 'p1', paymentMethod: 'razorpay', razorpayOrderId: 'order_app_closed', status: 'pending', amount: 25, createdAt: old },
            { _id: 'b', providerId: 'p1', paymentMethod: 'razorpay', razorpayOrderId: 'order_upi_later', status: 'cancelled', amount: 35, createdAt: old },
            { _id: 'c', providerId: 'p1', paymentMethod: 'razorpay', razorpayOrderId: 'order_never_paid', status: 'pending', amount: 45, createdAt: old },
            { _id: 'd', providerId: 'p1', paymentMethod: 'razorpay', razorpayOrderId: 'order_just_now', status: 'pending', amount: 55, createdAt: new Date(now) },
        ];
        const captured = { order_app_closed: 'pay_a', order_upi_later: 'pay_b', order_just_now: 'pay_d' };
        const asked = [];
        // The controller's Razorpay client (the stub, built at load) answers
        // what each order's payments were.
        globalThis.__rzpInstance.orders.fetchPayments = async (id) => {
            asked.push(id);
            return { items: captured[id] ? [{ id: captured[id], status: 'captured' }] : [{ id: 'pay_f', status: 'failed' }] };
        };

        const q = (list) => ({ sort() { return this; }, limit() { return this; }, skip() { return this; }, lean: async () => list, then: (res) => res(list) });
        WelfareFundContribution.find = (filter) => {
            if (filter.paymentMethod === 'razorpay') {
                const since = filter.createdAt.$gte, until = filter.createdAt.$lte;
                return q(rows.filter(r => String(r.providerId) === 'p1' && filter.status.$in.includes(r.status) && r.createdAt >= since && r.createdAt <= until));
            }
            return q(rows);
        };
        WelfareFundContribution.updateOne = async (f, u) => { const r = rows.find(x => x._id === f._id && x.status !== 'paid'); if (r) Object.assign(r, u.$set); };
        WelfareFundContribution.aggregate = async () => [];

        const r = await call(ctrl.getMyWelfareFundContributions, {});
        assert.strictEqual(r.code, 200);
        assert.deepStrictEqual(rows.map(x => `${x._id}:${x.status}`), ['a:paid', 'b:paid', 'c:pending', 'd:pending']);
        assert.strictEqual(rows[0].razorpayPaymentId, 'pay_a');
        assert.ok(!asked.includes('order_just_now'), 'a gift still being paid is left to its checkout');
    });

    const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'welfareFundController.js'), 'utf8');
    const root = path.join(__dirname, '..', '..', 'frontend', 'src');
    const fe = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
    await check('totals count paid gifts only (older rows without a status count as paid)', async () => {
        assert.ok(/const COUNTED = \{ status: \{ \$nin: \['pending', 'failed', 'cancelled'\] \} \};/.test(src));
        assert.strictEqual((src.match(/\$match: COUNTED/g) || []).length, 2, 'fund total and contributor count');
        assert.ok(/\$match: \{ \.\.\.scope, \.\.\.COUNTED \}/.test(src), 'my total');
        const model = fs.readFileSync(path.join(__dirname, '..', 'models', 'WelfareFundContribution.js'), 'utf8');
        assert.ok(/enum: \['pending', 'paid', 'failed', 'cancelled'\],\s*default: 'paid'/.test(model));
    });
    await check('partner card pays by UPI / card too; both cards share one Razorpay helper and show statuses', async () => {
        const partnerCard = fe('modules', 'provider', 'components', 'WelfareFundCard.jsx');
        const userCard = fe('modules', 'user', 'components', 'WelfareFundCard.jsx');
        const helper = fe('lib', 'welfareRazorpay.js');
        for (const card of [partnerCard, userCard]) {
            assert.ok(/payWelfareByRazorpay\(\{ amount, user \}\)/.test(card) && /<WelfareContributionHistory refreshKey=\{historyKey\}/.test(card));
            assert.ok(!/checkout\.razorpay\.com/.test(card), 'no copy of the Razorpay loader');
        }
        assert.ok(/Pay via UPI\/Card/.test(partnerCard) && /Pay via Wallet/.test(partnerCard));
        assert.ok(/ondismiss: \(\) => \{[\s\S]{0,80}close\("cancelled"\)/.test(helper));
        assert.ok(/checkout\.on\("payment\.failed", \(resp\) => \{\s*close\("failed"/.test(helper));
        // Paid but not confirmed by our server: "not confirmed yet", never "failed".
        assert.ok(/catch \(err\) \{[\s\S]{0,200}finish\(\{ status: "pending"/.test(helper));
        for (const card of [partnerCard, userCard]) assert.ok(/pending: "Payment not confirmed yet"/.test(card));
        assert.ok(/await reconcileRazorpayGifts\(scope\);/.test(src) && /razorpay\.orders\.fetchPayments\(gift\.razorpayOrderId\)/.test(src));
        const history = fe('components', 'WelfareContributionHistory.jsx');
        for (const s of ['Paid', 'Pending', 'Failed', 'Cancelled']) assert.ok(new RegExp(`label: "${s}"`).test(history), s);
    });

    console.log(`\n${passed} welfare razorpay status checks passed.`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
