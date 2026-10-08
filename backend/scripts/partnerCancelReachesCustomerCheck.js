/**
 * A partner's cancellation reaches the customer: a saved notification that
 * opens the booking, and the booking showing who cancelled and why.
 *
 * The cancellation notification was sent with type 'cancel', which was no
 * Notification type, so its in-app record never saved (the same for a
 * customer's own cancellation, and admins' SOS alerts). My Bookings showed
 * "Cancelled" with no word of who or why.
 *
 *   node scripts/partnerCancelReachesCustomerCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Notification = require('../models/Notification');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

check("every type the code saves in-app is a Notification type (a wrong one silently drops it)", () => {
    const allowed = Notification.schema.path('type').enumValues;
    const dir = path.join(__dirname, '..');
    const bad = [];
    for (const sub of ['controllers', 'config', 'services']) {
        for (const f of fs.readdirSync(path.join(dir, sub)).filter(n => n.endsWith('.js'))) {
            const s = fs.readFileSync(path.join(dir, sub, f), 'utf8');
            for (const marker of ['notifyUser({', 'Notification.create({']) {
                let i = 0;
                while ((i = s.indexOf(marker, i)) >= 0) {
                    const m = s.slice(i, i + 700).match(/^\s*type:\s*'([a-z_]+)'/m);
                    // The legacy /counter-offer routes (unused by the app) keep 'booking_update'.
                    if (m && !allowed.includes(m[1]) && m[1] !== 'booking_update') bad.push(`${sub}/${f}: ${m[1]}`);
                    i += marker.length;
                }
            }
        }
    }
    assert.deepStrictEqual(bad, []);
    for (const t of ['cancel', 'sos']) assert.ok(allowed.includes(t), t);
});

check('the partner-cancel notification opens that booking', () => {
    const s = read('backend', 'controllers', 'bookingController.js');
    const fn = s.slice(s.indexOf('const notifyCustomerOfProviderCancellation'), s.indexOf('const updateBookingStatusByProvider'));
    assert.ok(/link: `\/my-bookings\?bookingId=\$\{booking\._id\}`/.test(fn));
    assert.ok(/emitToUser\(booking\.userId, 'BOOKING_REJECTED'/.test(fn), 'live update for open screens');
});

check('My Bookings shows who cancelled and why, and opens the linked booking', () => {
    const s = read('frontend', 'src', 'modules', 'user', 'pages', 'ServiceHistory.jsx');
    assert.ok(/provider: 'Cancelled by Partner'/.test(s));
    assert.ok(/cancelledByLabel\(booking\.cancelledBy\)/.test(s) && /cancelledByLabel\(selectedBooking\.cancelledBy\)/.test(s));
    assert.ok(/Reason: \{selectedBooking\.cancellationReason\}/.test(s));
    assert.ok(/const linkedBookingId = searchParams\.get\("bookingId"\)/.test(s));
});

console.log(`\n${passed} partner cancel checks passed.`);
