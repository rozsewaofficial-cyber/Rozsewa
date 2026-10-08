/**
 * Partner registration answers a repeat of itself with the account it made.
 *
 * The last step (Complete Registration / Skip for Now) could reach the server
 * twice — a second tap while the first was saving, or a retry after a slow
 * reply. The first created the account; the second came back "Mobile number
 * is already registered", so the partner saw an error while admin already
 * had their application. Someone else using a registered number is still
 * refused, and no second account is ever made.
 *
 *   node scripts/partnerRegistrationRepeatCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'check-only-secret';
const assert = require('assert');
const Provider = require('../models/Provider');
require('../models/User').findOne = async () => null;
require('../models/User').find = () => ({ select: () => ({ lean: async () => [] }), lean: async () => [] });
require('../models/Setting').findOne = async () => null;
const { registerProvider } = require('../controllers/providerController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const existing = (minutesAgo, password = 'RegTest@123') => ({
    _id: 'p-existing', mobile: '7000000061', ownerName: 'Test Owner', shopName: 'Test Shop', status: 'pending',
    vendorCode: 'RSVND11111', accountType: 'business', createdAt: new Date(Date.now() - minutesAgo * 60000),
    matchPassword: async (p) => p === password
});

let stored = null;
let creates = 0;
Provider.findOne = async (q) => (stored && q && q.mobile === stored.mobile ? stored : null);
Provider.create = async (doc) => { creates += 1; return { ...doc, _id: 'p-new', status: 'pending' }; };

const register = (body) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    registerProvider({ body: {
        mobile: '7000000061', ownerName: 'Test Owner', shopName: 'Test Shop', accountType: 'business', businessType: 'shop',
        password: 'RegTest@123', address: 'a', city: 'b', state: 'c', ...body
    } }, res);
});

(async () => {
    await check('a new number creates the account', async () => {
        stored = null; creates = 0;
        const r = await register({});
        assert.strictEqual(r.code, 201);
        assert.strictEqual(creates, 1);
        assert.ok(r.body.token);
    });

    await check('the same person sending it again gets that account back, not an error', async () => {
        stored = existing(2); creates = 0;
        const r = await register({});
        assert.strictEqual(r.code, 200);
        assert.strictEqual(r.body.alreadyRegistered, true);
        assert.strictEqual(r.body.vendorCode, 'RSVND11111');
        assert.ok(r.body.token);
        assert.strictEqual(creates, 0, 'no second account');
    });

    await check('someone else with that number is told to log in', async () => {
        stored = existing(2); creates = 0;
        const r = await register({ password: 'Different@1' });
        assert.strictEqual(r.code, 400);
        assert.strictEqual(r.body.code, 'MOBILE_REGISTERED');
        assert.strictEqual(creates, 0);
    });

    await check('an old account is not treated as a repeat, even with the password', async () => {
        stored = existing(60 * 24); creates = 0;
        const r = await register({});
        assert.strictEqual(r.code, 400);
        assert.strictEqual(r.body.code, 'MOBILE_REGISTERED');
    });

    await check('two submissions at the same instant end on one account', async () => {
        // Both pass the first lookup; the unique index stops the second create.
        stored = null; creates = 0;
        Provider.create = async () => {
            stored = existing(0);
            const err = new Error('E11000 duplicate key error collection: providers index: mobile_1');
            err.code = 11000; err.keyPattern = { mobile: 1 };
            throw err;
        };
        const r = await register({});
        assert.strictEqual(r.code, 200);
        assert.strictEqual(r.body.alreadyRegistered, true);
        assert.strictEqual(r.body.vendorCode, 'RSVND11111');
    });

    console.log(`\n${passed} registration repeat checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
