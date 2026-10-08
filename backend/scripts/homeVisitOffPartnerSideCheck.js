/**
 * Home Visit off, partner side.
 *
 * A customer who books "At Home" without picking a partner sends the request to
 * nearby partners. Partners were picked by serviceModes only, so a partner who
 * had switched Home Visit OFF in their settings still got home requests, saw
 * them on their home page, and could accept or send an offer on them.
 *
 *   node scripts/homeVisitOffPartnerSideCheck.js
 *
 * Runs the real booking controller with the models stubbed; no database.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const { getProviderBookings, updateBookingStatusByProvider, counterOfferBooking } = require('../controllers/bookingController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const PID = '6ac390f95b5b65e279425c2c';
const partner = (homeOn, extra = {}) => ({
    _id: PID, status: 'verified', isOnline: true, providerCategory: 'partner',
    isHomeVisitAvailable: homeOn, serviceModes: ['home', 'shop'], location: { coordinates: [75.85, 22.72] }, ...extra,
});
const respond = () => {
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    return { res, done };
};
const lean = (value) => ({ select: () => ({ lean: async () => value }), lean: async () => value, then: (r) => Promise.resolve(value).then(r) });

(async () => {
    console.log('\nPartner home page only lists bookings the partner can do');

    await check('Home Visit off: home requests are not listed (shop requests still are)', async () => {
        Provider.findById = () => lean(partner(false));
        let asked;
        Booking.find = (q) => { asked = q; throw new Error('stop after the query'); };
        const { res, done } = respond();
        getProviderBookings({ user: { _id: PID, role: 'provider' }, query: { status: 'pending' } }, res).catch(() => {});
        await Promise.race([done, new Promise((r) => setTimeout(r, 300))]);
        assert.ok(asked, 'the pending query ran');
        assert.deepStrictEqual(asked.serviceLocation.$in, ['shop']);
    });

    await check('Home Visit on: home and shop requests are listed', async () => {
        Provider.findById = () => lean(partner(true));
        let asked;
        Booking.find = (q) => { asked = q; throw new Error('stop after the query'); };
        const { res, done } = respond();
        getProviderBookings({ user: { _id: PID, role: 'provider' }, query: { status: 'pending' } }, res).catch(() => {});
        await Promise.race([done, new Promise((r) => setTimeout(r, 300))]);
        assert.deepStrictEqual(asked.serviceLocation.$in, ['home', 'shop']);
    });

    await check('a sewak always gets home requests (Home Visit does not apply to sewaks)', async () => {
        Provider.findById = () => lean(partner(false, { providerCategory: 'sewak', serviceModes: ['home'] }));
        let asked;
        Booking.find = (q) => { asked = q; throw new Error('stop after the query'); };
        const { res, done } = respond();
        getProviderBookings({ user: { _id: PID, role: 'provider' }, query: { status: 'pending' } }, res).catch(() => {});
        await Promise.race([done, new Promise((r) => setTimeout(r, 300))]);
        assert.deepStrictEqual(asked.serviceLocation.$in, ['home']);
    });

    console.log('\nA partner with Home Visit off cannot take or bid on a home booking');

    const homeBooking = () => ({ _id: 'b1', status: 'pending', providerId: null, serviceLocation: 'home', negotiation: {}, rejectedProviders: [], save: async () => {} });

    await check('accept is refused', async () => {
        Booking.findById = async () => homeBooking();
        Provider.findById = () => lean(partner(false));
        const { res, done } = respond();
        updateBookingStatusByProvider({ params: { id: 'b1' }, body: { status: 'confirmed' }, user: { _id: PID, role: 'provider' } }, res);
        const r = await done;
        assert.strictEqual(r.code, 400);
        assert.ok(/Home Visit is switched off/.test(r.body.message));
    });

    await check('send offer is refused, and the booking is not locked to that partner', async () => {
        const booking = homeBooking();
        Booking.findById = async () => booking;
        Provider.findById = () => lean(partner(false));
        const { res, done } = respond();
        counterOfferBooking({ params: { id: 'b1' }, body: { amount: 500 }, user: { _id: PID, role: 'provider' } }, res);
        const r = await done;
        assert.strictEqual(r.code, 400);
        assert.ok(/Home Visit is switched off/.test(r.body.message));
        assert.strictEqual(booking.providerId, null);
    });

    console.log('\nA home request is only sent to partners with Home Visit on');

    await check('dispatch queries filter on isHomeVisitAvailable for partner home bookings', async () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'bookingController.js'), 'utf8');
        assert.ok(/if \(targetCategory !== 'sewak'\) \{\s*providerQuery\.isHomeVisitAvailable = \{ \$ne: false \};/.test(src), 'radius dispatch');
        assert.ok(/serviceLocation === 'home' && targetCategory !== 'sewak'\s*\? \{ isHomeVisitAvailable: \{ \$ne: false \} \}/.test(src), 'no-location fallback dispatch');
    });

    console.log(`\n${passed} home visit (partner side) checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
