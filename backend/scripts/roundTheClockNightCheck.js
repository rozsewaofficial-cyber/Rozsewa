/**
 * A partner who switched on 24/7 shows as open at night, whichever switch they
 * used. The Timing screen stores it as is24x7; the Settings "24/7 Service"
 * tile and the dashboard Emergency button store it as isEmergencyEnabled. Each
 * switch now writes both, every reader accepts either, and Checkout offers all
 * 24 hours (dated by the customer's own calendar day, not UTC).
 *
 *   node scripts/roundTheClockNightCheck.js
 *
 * Runs the real controllers with the models stubbed and the clock pinned to
 * 02:30 IST on a Tuesday; no database needed.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const { getPublicProviderById } = require('../controllers/homeController');
const { updateProviderStatus } = require('../controllers/providerController');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

// Tuesday 2026-10-06 02:30 IST == Monday 21:00 UTC.
const RealDate = Date;
const NIGHT = RealDate.parse('2026-10-05T21:00:00Z');
global.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [NIGHT])); }
    static now() { return NIGHT; }
};

// Open 06:00-22:00 every day — closed at 02:30 unless 24/7.
const schedule = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map(day => ({ day, startTime: '06:00', endTime: '22:00', isActive: true }));

let doc;
Provider.findById = () => ({
    select: () => ({ populate: async () => ({ ...doc, _id: 'p1', toObject: () => ({ ...doc }) }) })
});
Booking.find = () => ({ select: async () => [] });

const res = () => {
    const r = { code: 200, body: undefined };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};
const openNow = async (flags) => {
    doc = { availability: schedule, isOnline: true, ...flags };
    const r = res();
    await getPublicProviderById({ params: { id: 'p1' } }, r);
    assert.strictEqual(r.code, 200, JSON.stringify(r.body));
    return r.body.isWithinWorkingHours;
};

(async () => {
    await check('without 24/7 the shop is closed at 02:30', async () => {
        assert.strictEqual(await openNow({}), false);
    });
    await check('24/7 from the Timing screen (is24x7) keeps it open at night', async () => {
        assert.strictEqual(await openNow({ is24x7: true }), true);
    });
    await check('24/7 from Settings / dashboard (isEmergencyEnabled) keeps it open at night', async () => {
        assert.strictEqual(await openNow({ isEmergencyEnabled: true }), true);
    });

    await check('the Settings / dashboard switch writes both fields, on and off', async () => {
        for (const on of [true, false]) {
            const p = { _id: 'p1', isEmergencyEnabled: !on, is24x7: !on, save: async () => {} };
            Provider.findById = async () => p;
            const r = res();
            await updateProviderStatus({ user: { _id: 'p1' }, body: { isEmergencyEnabled: on } }, r);
            assert.strictEqual(p.isEmergencyEnabled, on);
            assert.strictEqual(p.is24x7, on);
            assert.strictEqual(r.body.is24x7, on);
        }
    });

    await check('the Timing screen save writes both fields', async () => {
        const src = read('backend', 'controllers', 'providerController.js');
        assert.ok(/provider\.is24x7 = !!req\.body\.is24x7;\s*provider\.isEmergencyEnabled = !!req\.body\.is24x7;/.test(src));
    });

    await check('the 24/7 and emergency listing filters accept either field', async () => {
        const src = read('backend', 'controllers', 'homeController.js');
        assert.ok(/emergency === 'true'\) \{\s*andClauses\.push\(\{ \$or: \[\{ is24x7: true \}, \{ isEmergencyEnabled: true \}\] \}\)/.test(src));
        assert.ok(!/query\.isEmergencyEnabled = true/.test(src));
    });

    await check('partner screens read either field as ON', async () => {
        const avail = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderAvailability.jsx');
        assert.ok(/setIs24x7\(!!\(data\.is24x7 \|\| data\.isEmergencyEnabled\)\)/.test(avail));
        assert.ok(/updateUser\(\{ is24x7, isEmergencyEnabled: is24x7 \}\)/.test(avail));
        const settings = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderSettings.jsx');
        assert.ok(/const roundTheClock = !!\(provider\?\.isEmergencyEnabled \|\| provider\?\.is24x7\)/.test(settings));
        assert.ok(!/provider\?\.isEmergencyEnabled \?/.test(settings));
        const dash = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx');
        assert.ok(/setIsEmergencyActive\(!!\(user\.isEmergencyEnabled \|\| user\.is24x7\)\)/.test(dash));
    });

    await check('Checkout offers all 24 hours to a 24/7 partner, dated by the local day', async () => {
        const co = read('frontend', 'src', 'modules', 'user', 'pages', 'Checkout.jsx');
        assert.ok(/roundTheClock: !!\(pData\.is24x7 \|\| pData\.isEmergencyEnabled\)/.test(co));
        assert.ok(/if \(providerHours\.roundTheClock\) \{\s*return Array\.from\(\{ length: 24 \}/.test(co));
        assert.ok(/full: localDateKey\(d\)/.test(co));
        assert.ok(!/toISOString\(\)\.split\("T"\)\[0\]/.test(co));
    });

    console.log(`\n${passed} round-the-clock night checks passed.\n`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
