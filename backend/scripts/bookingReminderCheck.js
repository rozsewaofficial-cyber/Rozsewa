/**
 * Booking reminders to the partner: 60, 30, 15 and 5 minutes before the start,
 * each once, only the nearest one when several are due, and none long after.
 *
 *   node scripts/bookingReminderCheck.js
 */
const assert = require('assert');
const { dueReminder, REMINDER_MINUTES } = require('../cron/bookingReminders');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

// A booking that starts at 17:00 IST on 18 Jun 2026, whatever this machine's clock says.
const booking = (over = {}) => ({ bookingDate: '2026-06-18', bookingTime: '05:00 PM', providerId: 'p1', remindersSent: [], ...over });
const START = Date.UTC(2026, 5, 18, 17, 0) - 330 * 60000;
const at = (minutesBefore) => new Date(START - minutesBefore * 60000);

check('the reminder times are 60, 30, 15 and 5 minutes', () => {
    assert.deepStrictEqual(REMINDER_MINUTES, [60, 30, 15, 5]);
});

check('nothing before the first slot', () => {
    assert.strictEqual(dueReminder(booking(), at(120)), null);
    assert.strictEqual(dueReminder(booking(), at(61)), null);
});

check('each slot is due once it has come round', () => {
    assert.strictEqual(dueReminder(booking(), at(60)).slot, 60);
    assert.strictEqual(dueReminder(booking({ remindersSent: [60] }), at(30)).slot, 30);
    assert.strictEqual(dueReminder(booking({ remindersSent: [60, 30] }), at(15)).slot, 15);
    assert.strictEqual(dueReminder(booking({ remindersSent: [60, 30, 15] }), at(5)).slot, 5);
});

check('a slot already sent is never sent again', () => {
    assert.strictEqual(dueReminder(booking({ remindersSent: [60] }), at(59)), null);
    assert.strictEqual(dueReminder(booking({ remindersSent: [60, 30, 15, 5] }), at(2)), null);
});

check('a missed tick does not lose a reminder', () => {
    // The clock jumped from 62 to 28 minutes: the 30-minute reminder is still sent.
    const r = dueReminder(booking({ remindersSent: [] }), at(28));
    assert.strictEqual(r.slot, 30);
});

check('only the nearest slot is sent when several are due, and all are recorded', () => {
    // Confirmed 24 minutes out: "in 24 minutes", not a stale "in an hour" too.
    const r = dueReminder(booking(), at(24));
    assert.strictEqual(r.slot, 30);
    assert.deepStrictEqual(r.allDue.sort((a, b) => b - a), [60, 30]);
    assert.strictEqual(r.minutesLeft, 24);
});

check('a booking that has just started still gets its last reminder, a long-gone one does not', () => {
    assert.strictEqual(dueReminder(booking({ remindersSent: [60, 30, 15] }), at(-3)).slot, 5);
    assert.strictEqual(dueReminder(booking(), at(-20)), null);
});

check('a booking without a partner or a time is skipped', () => {
    assert.strictEqual(dueReminder(booking({ providerId: null }), at(20)), null);
    assert.strictEqual(dueReminder(booking({ bookingTime: '' }), at(20)), null);
    assert.strictEqual(dueReminder(booking({ bookingDate: 'soon' }), at(20)), null);
});

check('the time is read as IST even when the server runs in another timezone', () => {
    const keep = process.env.TZ;
    // dueReminder works from UTC arithmetic, so the result must not depend on TZ at all.
    const a = dueReminder(booking(), at(25));
    assert.strictEqual(a.minutesLeft, 25);
    assert.strictEqual(a.slot, 30);
    if (keep === undefined) delete process.env.TZ; else process.env.TZ = keep;
});

console.log(`\n${passed} booking reminder checks passed.`);
