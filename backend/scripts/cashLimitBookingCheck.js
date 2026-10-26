/**
 * A booking aimed at one partner is refused when that partner has reached the
 * cash limit (the state where their app shows "Pay to Admin"), instead of being
 * sent to someone who cannot accept it.
 *
 *   node scripts/cashLimitBookingCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
const { Wallet } = require('../models/Wallet');
const Setting = require('../models/Setting');
const { cashLimitStatus } = require('../utils/cashLimit');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const setup = (balance, value) => {
    Wallet.findOne = () => ({ select: () => ({ lean: async () => (balance === null ? null : { balance }) }) });
    Setting.findOne = () => ({ lean: async () => (value ? { value } : null) });
};
const p = { _id: 'p1', vendorType: { toString: () => 'cat1' } };

(async () => {
    await check('under the default limit is fine, at it is over', async () => {
        setup(-1499); assert.strictEqual((await cashLimitStatus(p)).over, false);
        setup(-1500); assert.strictEqual((await cashLimitStatus(p)).over, true);
        setup(null); assert.strictEqual((await cashLimitStatus(p)).over, false);
    });
    await check('category and service limits override the default', async () => {
        const cfg = { defaultLimit: 1500, categoryLimits: [{ categoryId: 'cat1', limit: 500 }], serviceLimits: [{ serviceId: 's1', limit: 200 }] };
        setup(-600, cfg); assert.strictEqual((await cashLimitStatus(p)).over, true);
        setup(-300, cfg); assert.strictEqual((await cashLimitStatus(p)).over, false);
        assert.strictEqual((await cashLimitStatus(p, 's1')).over, true);
    });
    await check('createBooking refuses a specific partner who is over the limit', async () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'bookingController.js'), 'utf8');
        const at = src.indexOf('cashLimitStatus(specificProvider, serviceId)');
        assert.ok(at > 0 && src.indexOf('const newBooking = new Booking(', at) > at, 'checked before the booking is created');
        assert.ok(/cashLimitStatus\(specificProvider, serviceId\)\)\.over\) \{\s*return res\.status\(409\)/.test(src));
    });
    console.log(`\n${passed} cash limit booking checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
