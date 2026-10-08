/**
 * Partner wallet recharge: credited once, only for a verified payment, for
 * what was actually paid, and shown on the wallet.
 *
 *   node scripts/walletRechargeCheck.js
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

const PaymentOrder = require('../models/PaymentOrder');
const Provider = require('../models/Provider');
const { Wallet, Transaction } = require('../models/Wallet');
const pay = require('../controllers/paymentController');
const { addMoney } = require('../controllers/walletController');
// Never reach Razorpay from a check.
pay.razorpay.payments.fetch = async () => ({ method: 'upi' });
pay.razorpay.orders.fetchPayments = async () => { throw new Error('no gateway in checks'); };

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const sign = (o, p) => crypto.createHmac('sha256', 'check_secret').update(`${o}|${p}`).digest('hex');
const call = (fn, req) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn(req, res);
});

// One recorded order for ₹1000, claimable once.
let orders, wallet, txs;
const reset = (balance = 500) => {
    orders = { order_1: { orderId: 'order_1', amount: 1000, purpose: 'wallet', providerId: 'p1', consumedBy: null } };
    wallet = { providerId: 'p1', balance, cashCommissionDues: 0, save: async function () { return this; } };
    txs = [];
};
PaymentOrder.consume = async (orderId, paymentId) => {
    const o = orders[orderId];
    if (!o || o.consumedBy) return null;
    o.consumedBy = paymentId;
    return o;
};
Wallet.updateOne = async () => ({});
// Is this order already spent by this exact payment? (verify's already-credited case)
PaymentOrder.findOne = (q) => ({ lean: async () => (orders[q.orderId] && orders[q.orderId].consumedBy === q.consumedBy && q.providerId === 'p1' ? orders[q.orderId] : null) });
PaymentOrder.updateOne = async (q, u) => { if (orders[q.orderId] && orders[q.orderId].consumedBy === q.consumedBy) orders[q.orderId].consumedBy = u.consumedBy; return {}; };
Wallet.findOne = () => ({ select: () => ({ lean: async () => ({ balance: wallet.balance }) }) });
Wallet.findOneAndUpdate = async (q, u) => { wallet.balance += u.$inc.balance; return wallet; };
Transaction.create = async (t) => { txs.push(t); return t; };
Provider.updateOne = async () => ({});

const partner = { _id: 'p1', role: 'provider' };
const verify = (body, user = partner) => call(pay.verifyWalletRecharge, { body, user });

(async () => {
    await check('a verified payment adds what the order was for: ₹500 + ₹1000 = ₹1500', async () => {
        reset(500);
        const r = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1'), amount: 999999 });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(wallet.balance, 1500);
        assert.strictEqual(r.body.balance, 1500);
        const t = txs[0];
        assert.strictEqual(t.title, 'Wallet Recharge');
        assert.strictEqual(t.amount, 1000, 'never the amount in the request');
        assert.strictEqual(t.paymentId, 'pay_1');
        assert.strictEqual(t.orderId, 'order_1');
        assert.strictEqual(t.status, 'completed');
        assert.strictEqual(t.balanceAfter, 1500);
        assert.strictEqual(t.paymentMethod, 'UPI');
    });

    await check('the same payment cannot credit twice', async () => {
        // Sent again: told it is done, nothing added.
        const r = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1') });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(r.body.alreadyCredited, true);
        assert.strictEqual(wallet.balance, 1500);
        assert.strictEqual(txs.length, 1);
        // Another payment presented against the spent order: refused.
        const other = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_x', razorpay_signature: sign('order_1', 'pay_x') });
        assert.strictEqual(other.code, 409);
        assert.strictEqual(wallet.balance, 1500);
    });

    await check('confirming a payment already credited (by reconcile) reports success, adds nothing', async () => {
        reset(500);
        orders.order_1.consumedBy = 'pay_9'; // reconcile claimed and credited it
        PaymentOrder.findOne = (q) => ({ lean: async () => (orders[q.orderId]?.consumedBy === q.consumedBy && q.providerId === 'p1' ? orders[q.orderId] : null) });
        const r = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_9', razorpay_signature: sign('order_1', 'pay_9') });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(r.body.alreadyCredited, true);
        assert.strictEqual(wallet.balance, 500, 'not added a second time');
        assert.strictEqual(txs.length, 0);
    });

    await check('if the wallet update fails, the payment is released so it is credited later, not lost', async () => {
        reset(500);
        const released = [];
        PaymentOrder.updateOne = async (q, u) => { released.push([q, u]); if (orders[q.orderId]) orders[q.orderId].consumedBy = u.consumedBy; return {}; };
        const realInc = Wallet.findOneAndUpdate;
        Wallet.findOneAndUpdate = async () => { throw new Error('db down'); };
        const r = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_5', razorpay_signature: sign('order_1', 'pay_5') });
        Wallet.findOneAndUpdate = realInc;
        assert.strictEqual(r.code, 500);
        assert.strictEqual(orders.order_1.consumedBy, null, 'claim given back');
        // Trying again now credits it, once.
        const again = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_5', razorpay_signature: sign('order_1', 'pay_5') });
        assert.strictEqual(again.code, 200);
        assert.strictEqual(wallet.balance, 1500);
    });

    await check('a bad signature (failed / forged payment) adds nothing', async () => {
        reset(500);
        const r = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_2', razorpay_signature: 'nope' });
        assert.strictEqual(r.code, 400);
        assert.strictEqual(wallet.balance, 500);
        assert.strictEqual(orders.order_1.consumedBy, null, 'the order stays open');
    });

    await check("another account can't claim this partner's order", async () => {
        reset(500);
        const r = await verify({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_3', razorpay_signature: sign('order_1', 'pay_3') }, { _id: 'p2', role: 'provider' });
        assert.strictEqual(r.code, 403);
        assert.strictEqual(wallet.balance, 500);
    });

    await check('no free credit: /wallet/add is refused for partners and customers', async () => {
        for (const role of ['provider', 'customer']) {
            const r = await call(addMoney, { body: { amount: 100000 }, user: { _id: 'x', role } });
            assert.strictEqual(r.code, 403, role);
        }
    });

    await check('orders carry the server key, and recharge amounts are bounded', async () => {
        const src = read('backend', 'controllers', 'paymentController.js');
        assert.ok(/res\.json\(\{ \.\.\.order, key: process\.env\.RAZORPAY_KEY_ID \}\)/.test(src));
        assert.ok(/amount < WALLET_RECHARGE_MIN \|\| amount > WALLET_RECHARGE_MAX/.test(src));
        const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderWallet.jsx');
        assert.strictEqual((page.match(/key: order\.key \|\| import\.meta\.env\.VITE_RAZORPAY_KEY_ID/g) || []).length, 2);
        assert.ok(!/rzp_test_8sYbzHWidwe5Zw/.test(page), 'no hardcoded test key on the wallet');
    });

    await check('reconcile credits only captured payments, through the same once-only claim', async () => {
        const src = read('backend', 'controllers', 'paymentController.js');
        const body = src.slice(src.indexOf('const reconcileWalletRecharges'), src.indexOf("module.exports = {"));
        assert.ok(/p\.status === 'captured'/.test(body));
        assert.ok(/PaymentOrder\.consume\(o\.orderId, paid\.id\)/.test(body));
        assert.ok(/providerId: req\.user\._id, purpose: 'wallet', consumedBy: null/.test(body), 'only this partner\'s open wallet orders');
    });

    await check('the wallet shows the recharged balance, and cancel / failure leave it unchanged', async () => {
        const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderWallet.jsx');
        assert.ok(/balance < 0 \? "Cash Commission Dues" : "Wallet Balance"/.test(page));
        assert.ok(/ondismiss: \(\) => toast\(\{ title: "Payment cancelled"/.test(page));
        assert.ok(/Your wallet balance is unchanged/.test(page));
        assert.ok(/API\.post\("\/payment\/wallet\/reconcile"\)/.test(page));
    });

    console.log(`\n${passed} wallet recharge checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
