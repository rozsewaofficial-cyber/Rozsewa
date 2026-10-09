/**
 * My Bookings: Track Service on every booking in progress (confirmed, on
 * the way, started) — it was only on confirmed ones — and it opens that
 * booking, not whichever one Live Tracking would pick first.
 *
 *   node scripts/trackServiceButtonCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'ServiceHistory.jsx'), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('shown for confirmed, on the way and started bookings', () => {
    assert.ok(/\["confirmed", "on_the_way", "started"\]\.includes\(booking\.status\) && \(/.test(page));
    assert.ok(!/booking\.status === "confirmed" && \(\s*<motion\.button whileTap=\{\{ scale: 0\.95 \}\} onClick=\{\(\) => navigate\("\/tracking"\)\}/.test(page));
});
check('opens the booking it is on', () => {
    assert.ok(/navigate\(`\/tracking\?bookingId=\$\{booking\.id\}`\)/.test(page));
});
check('started / on the way have their own status colour and a readable label', () => {
    assert.ok(/on_the_way: "bg-sky-100/.test(page) && /started: "bg-indigo-100/.test(page));
    assert.ok(/String\(booking\.status\)\.replace\(\/_\/g, ' '\)/.test(page));
});

check('booking details: Chat while in progress, Reschedule only when confirmed', () => {
    assert.ok(/\["confirmed", "on_the_way", "started"\]\.includes\(selectedBooking\.status\) && \(/.test(page));
    assert.ok(/selectedBooking\.status === "confirmed" && \(\s*<button onClick=\{\(\) => setShowReschedule\(true\)\}/.test(page));
});
check('the home page booking card opens its own booking', () => {
    const card = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'components', 'RecentBookingTracker.jsx'), 'utf8');
    assert.ok(/navigate\(`\/tracking\?bookingId=\$\{activeBooking\._id\}`\)/.test(card));
});

console.log(`\n${passed} track service checks passed.`);
