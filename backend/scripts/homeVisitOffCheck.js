/**
 * Home Visit off means no "At Home" for the customer.
 *
 * With the partner's Home Visit switched off, Checkout still showed an
 * At Home card (greyed out, "Not offered by this provider"). It is now not
 * shown at all; the same goes for a service the partner offers at the shop
 * only, and the server refuses such a home booking.
 *
 *   node scripts/homeVisitOffCheck.js
 *
 * Runs the real booking controller with the models stubbed; no database.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const { createBooking } = require('../controllers/bookingController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', ...p), 'utf8');

const PID = '6ac390f95b5b65e279425c2c';
const SID = '6ac76093cf93d73a2e8a0c02';
const partner = (homeOn) => ({ _id: PID, status: 'verified', isOnline: true, providerCategory: 'partner', isHomeVisitAvailable: homeOn });
const call = (body) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    createBooking({ body: { serviceName: 'Geyser Repair', providerId: PID, serviceId: SID, totalAmount: 399, paymentMode: 'after', items: [{ id: SID }], ...body }, user: { _id: 'u1', role: 'customer' } }, res)
        .catch(e => resolve({ code: 500, body: { message: e.message } }));
});

(async () => {
    await check('Home Visit off: a home booking is refused', async () => {
        Provider.findById = async () => partner(false);
        const r = await call({ serviceLocation: 'home' });
        assert.strictEqual(r.code, 400);
        assert.ok(/does not offer home visits/.test(r.body.message));
    });

    await check('Home Visit on, but the service is shop-only: a home booking is refused', async () => {
        Provider.findById = async () => partner(true);
        let asked;
        Service.findOne = (q) => { asked = q; return { select: () => ({ lean: async () => ({ name: 'Geyser Repair' }) }) }; };
        const r = await call({ serviceLocation: 'home' });
        assert.strictEqual(r.code, 400);
        assert.ok(/offered at the shop only/.test(r.body.message));
        assert.deepStrictEqual(asked.serviceType.$nin, ['home', 'both']);
        assert.strictEqual(String(asked.providerId), PID, "only this partner's own service");
    });

    await check('Checkout shows no At Home option when it is not offered', async () => {
        const s = read('modules', 'user', 'pages', 'Checkout.jsx');
        assert.ok(/data-service-location="shop-only"/.test(s));
        assert.ok(/itemTypes\.every\(t => t\.includes\("home"\) \|\| t\.includes\("both"\)\)/.test(s), 'per-service types count');
        assert.ok(/if \(checkoutData\.providerId && !providerDetails\) return null;/.test(s), 'no flash of At Home while loading');
        assert.ok(!/Not offered by this provider/.test(s), 'no greyed-out At Home card');
        const shop = read('modules', 'user', 'pages', 'ShopDetail.jsx');
        assert.ok(/expressPrice: d\.expressPrice, serviceType: d\.serviceType/.test(shop), "each item carries its service's types");
    });

    console.log(`\n${passed} home visit checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
