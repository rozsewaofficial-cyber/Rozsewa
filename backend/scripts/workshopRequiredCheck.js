/**
 * Workshop Required: the customer's item goes to the partner's shop and
 * back, each handover against a customer OTP; the job can't be completed
 * while the item is away; the partner never receives any customer OTP.
 *
 *   node scripts/workshopRequiredCheck.js
 *
 * Runs the real controller with the model stubbed; no database.
 */
const assert = require('assert');
require('mongoose').set('bufferCommands', false);
const Booking = require('../models/Booking');
const ctrl = require('../controllers/bookingController');
const { scrub } = require('../utils/hideBookingOtps');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const partner = { _id: 'p1', role: 'provider' };
let booking;
const fresh = (status = 'started') => ({
    _id: 'b1', userId: 'u1', providerId: 'p1', status, workshop: { status: null },
    markModified() {}, save: async function () { return this; }
});
Booking.findById = async () => booking;
const call = (fn, body = {}, user = partner) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn({ params: { id: 'b1' }, body, user }, res);
});

(async () => {
    await check('pickup: needs what is taken, sends a random 4-digit OTP, then the right OTP moves it to the workshop', async () => {
        booking = fresh();
        assert.strictEqual((await call(ctrl.requestWorkshop, { reason: 'x' })).code, 400, 'a reason is required');
        const r = await call(ctrl.requestWorkshop, { reason: 'Mixer motor' });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(booking.workshop.status, 'pickup_pending');
        assert.ok(/^\d{4}$/.test(booking.workshop.pickupOTP));
        const otp = booking.workshop.pickupOTP;
        assert.strictEqual((await call(ctrl.verifyWorkshopPickup, { otp: otp === '1234' ? '4321' : '1234' })).code, 400);
        assert.strictEqual(booking.workshop.status, 'pickup_pending');
        assert.strictEqual((await call(ctrl.verifyWorkshopPickup, { otp })).code, 200);
        assert.strictEqual(booking.workshop.status, 'at_workshop');
        assert.strictEqual(booking.workshop.pickupOTP, null, 'used once');
    });

    await check('the job cannot be completed while the item is away', async () => {
        const r = await call(ctrl.verifyEndOTP, { otp: '0000' });
        assert.strictEqual(r.code, 400);
        assert.ok(/before completing/.test(r.body.message));
    });

    await check('return: a return OTP, then the right OTP gives it back', async () => {
        assert.strictEqual((await call(ctrl.requestWorkshopReturn)).code, 200);
        assert.strictEqual(booking.workshop.status, 'return_pending');
        assert.strictEqual((await call(ctrl.verifyWorkshopReturn, { otp: booking.workshop.returnOTP })).code, 200);
        assert.strictEqual(booking.workshop.status, 'returned');
        assert.strictEqual(booking.workshop.returnOTP, null);
    });

    await check('5 wrong tries void the OTP; a new one must be sent', async () => {
        booking = fresh();
        await call(ctrl.requestWorkshop, { reason: 'Mixer motor' });
        const wrong = booking.workshop.pickupOTP === '9999' ? '0000' : '9999';
        for (let i = 0; i < 5; i += 1) await call(ctrl.verifyWorkshopPickup, { otp: wrong });
        assert.strictEqual(booking.workshop.pickupOTP, null);
        const r = await call(ctrl.verifyWorkshopPickup, { otp: wrong });
        assert.ok(/Send a new one/.test(r.body.message));
    });

    await check('only the partner on the job, only while it is in progress; a pending pickup can be cancelled', async () => {
        booking = fresh();
        assert.strictEqual((await call(ctrl.requestWorkshop, { reason: 'Mixer motor' }, { _id: 'p2', role: 'provider' })).code, 403);
        assert.strictEqual((await call(ctrl.requestWorkshop, { reason: 'Mixer motor' }, { _id: 'u1', role: 'customer' })).code, 403);
        booking = fresh('confirmed');
        assert.strictEqual((await call(ctrl.requestWorkshop, { reason: 'Mixer motor' })).code, 400);
        booking = fresh();
        await call(ctrl.requestWorkshop, { reason: 'Mixer motor' });
        assert.strictEqual((await call(ctrl.cancelWorkshop)).code, 200);
        assert.strictEqual(booking.workshop.status, null);
    });

    await check('the workshop step comes before the completion OTP', async () => {
        booking = fresh();
        booking.endOTP = '4567';
        const r = await call(ctrl.requestWorkshop, { reason: 'Mixer motor' });
        assert.strictEqual(r.code, 400);
        assert.strictEqual(booking.workshop.status, null);
    });

    await check("a partner's responses carry no customer OTP, only 'sent' flags", async () => {
        const out = scrub([{ _id: 'b', startOTP: '1111', endOTP: '2222', workshop: { status: 'pickup_pending', pickupOTP: '3333', returnOTP: null } }]);
        assert.deepStrictEqual(out[0], { _id: 'b', startOtpSent: true, endOtpSent: true, workshop: { status: 'pickup_pending', pickupOtpSent: true, returnOtpSent: false } });
        const wrapped = scrub({ message: 'ok', booking: { endOTP: '2222', workshop: {} } });
        assert.ok(!('endOTP' in wrapped.booking) && wrapped.booking.endOtpSent === true);
    });

    console.log(`\n${passed} workshop checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
