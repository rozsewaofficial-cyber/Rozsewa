/**
 * Cancelling a booking keeps the customer on THAT booking. Live Tracking used
 * to fall back to any old completed-but-unrated booking and open its "Service
 * Completed" bill; the bill page itself picked "the first unrated booking"
 * instead of the one it was sent for. The cancelled screen also said "no
 * providers accepted your request" when the customer had cancelled it.
 *
 *   node scripts/cancelShowsOwnBookingCheck.js
 *
 * The picking rules themselves are unit-tested in
 * frontend/src/test/trackedBooking.test.js (npm --prefix frontend test).
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const tracking = read('frontend', 'src', 'modules', 'user', 'pages', 'LiveTracking.jsx');
const post = read('frontend', 'src', 'modules', 'user', 'pages', 'PostService.jsx');
const picker = read('frontend', 'src', 'lib', 'trackedBooking.js');
const booking = read('backend', 'controllers', 'bookingController.js');

check('Live Tracking picks its booking with pickTrackedBooking, tracking the one on screen', () => {
    assert.ok(/pickTrackedBooking\(data, \{\s*trackedId: bookingDetailsRef\.current\?\._id,/.test(tracking));
    assert.ok(!/b\.status === "completed" && \(!b\.rating \|\| b\.rating === 0\),\s*\);/.test(tracking), 'the any-age completed fallback is gone');
});

check('an old completed booking is only picked within the recent window', () => {
    assert.ok(/RECENT_COMPLETION_MINUTES = 60/.test(picker));
    assert.ok(/minutesAgo\(b, now\) <= RECENT_COMPLETION_MINUTES/.test(picker));
});

check('the bill page opens the booking it was sent for', () => {
    assert.ok(/navigate\(`\/post-service\?bookingId=\$\{active\._id\}`\)/.test(tracking));
    assert.ok(/navigate\(`\/post-service\?bookingId=\$\{bookingDetails\?\._id\}`\)/.test(tracking));
    assert.ok(/const bookingId = searchParams\.get\("bookingId"\);/.test(post));
    assert.ok(/bookingId\s*\?\s*data\.find\(\(b\) => b\._id === bookingId\)/.test(post));
});

check('a customer cancellation is recorded and shown as theirs', () => {
    assert.ok(/status === 'cancelled' && booking\.userId && booking\.userId\.toString\(\) === req\.user\._id\.toString\(\)\) \{\s*booking\.cancelledBy = 'user';/.test(booking));
    assert.ok(/updateFields\.offerStatus = 'counter_rejected';\s*updateFields\.cancelledBy = 'user';/.test(booking));
    assert.ok(/bookingDetails\.cancelledBy === "user"\s*\?\s*"Booking Cancelled"/.test(tracking));
});

console.log(`\n${passed} cancel-shows-own-booking checks passed.\n`);
