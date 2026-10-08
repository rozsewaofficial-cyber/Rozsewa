/**
 * A partner's counter-offer on a bargained booking reaches the customer:
 * a notification naming the partner, service and amounts, that opens that
 * booking's offer; and the booking screens show who it is with.
 *
 *   node scripts/bargainOfferNotificationCheck.js
 *
 * Reads the code paths (the full flow was exercised in the browser:
 * partner counter -> customer notified live -> tap opens the offer ->
 * accept confirms on both sides).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const booking = read('backend', 'controllers', 'bookingController.js');

check('the offer notification names the partner, service and both amounts', () => {
    assert.ok(/title: `New offer from \$\{partnerName\}`/.test(booking));
    assert.ok(/You have received a new offer from \$\{partnerName\}: ₹\$\{offered\} for \$\{booking\.serviceName\} \(your offer ₹\$\{booking\.customerOffer\}\)/.test(booking));
});

check('it links to that booking, and the link is stored and followed', () => {
    assert.ok(/data: \{ link: `\/tracking\?bookingId=\$\{booking\._id\}`/.test(booking));
    assert.ok(/link: \{ type: String \}/.test(read('backend', 'models', 'Notification.js')));
    assert.ok(/notificationData\.link = data\.link/.test(read('backend', 'config', 'notificationService.js')));
    assert.ok(/let targetLink = notif\.link \|\| ""/.test(read('frontend', 'src', 'modules', 'user', 'pages', 'Notifications.jsx')));
});

check('Live Tracking opens the booking it was sent to', () => {
    // pickTrackedBooking is ESM; evaluate it here.
    const src = read('frontend', 'src', 'lib', 'trackedBooking.js').replace(/export const /g, 'const ');
    const mod = { exports: {} };
    new Function('module', src + '\nmodule.exports = { pickTrackedBooking };')(mod);
    const { pickTrackedBooking } = mod.exports;
    const list = [{ _id: 'newer', status: 'confirmed' }, { _id: 'offer', status: 'pending' }];
    assert.strictEqual(pickTrackedBooking(list)._id, 'newer');
    assert.strictEqual(pickTrackedBooking(list, { requestedId: 'offer' })._id, 'offer');
    assert.strictEqual(pickTrackedBooking([{ _id: 'offer', status: 'cancelled' }, { _id: 'newer', status: 'confirmed' }], { requestedId: 'offer' })._id, 'newer', 'a finished one falls back');
    assert.ok(/requestedId: requestedBookingId/.test(read('frontend', 'src', 'modules', 'user', 'pages', 'LiveTracking.jsx')));
});

check('a bargain request is announced as "Offer Sent", not a confirmed booking', () => {
    assert.ok(/title: 'Offer Sent'/.test(booking));
});

check('My Bookings shows the partner and their offer', () => {
    const page = read('frontend', 'src', 'modules', 'user', 'pages', 'ServiceHistory.jsx');
    assert.ok(/with \{booking\.partnerName\}/.test(page));
    assert.ok(/offered ₹\{booking\.partnerCounterTotal \?\? booking\.partnerCounterOffer\}/.test(page));
});

console.log(`\n${passed} bargain offer checks passed.`);
