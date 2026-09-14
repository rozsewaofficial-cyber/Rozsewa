/**
 * Pins down the customer -> Sewak booking flow.
 *
 * Every one of these guards a bug that shipped: a Sewak who could not be found
 * by customers at all, a worker still offered Accept/Reject on a job they had
 * already taken, and a "Booking Completed" message on a booking that was not
 * completed.
 *
 * Pure source and logic checks, no database — safe to run anywhere:
 *
 *   node scripts/sewakBookingCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const backend = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const frontend = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', ...p), 'utf8');

console.log('\nA Sewak is visible to customers');
const home = backend('controllers', 'homeController.js');
check('every public provider projection includes providerCategory', () => {
    // The enrichment below branches on `providerCategory`. Leaving it out of the
    // projection made it undefined, so a Sewak was treated as a Partner, looked
    // for Service documents it does not own, and was dropped from the list —
    // Sewaks were unbookable through browse.
    const selects = home.match(/\.select\('[^']*'\)/g) || [];
    const providerSelects = selects.filter(s => /shopName/.test(s));
    assert.ok(providerSelects.length >= 3, 'expected the provider projections to still exist');
    providerSelects.forEach(s => {
        assert.ok(/providerCategory/.test(s), `a provider projection omits providerCategory: ${s.slice(0, 80)}`);
    });
});
check('a Sewak is priced from its category, not from own Service rows', () => {
    // A Sewak sells the category's services via subServices and owns no Service
    // documents, which is exactly why the misread above hid them.
    assert.ok(/const isSewak = p\.providerCategory === 'sewak'/.test(home));
    assert.ok(/if \(isSewak\)[\s\S]{0,200}vendorType\?\.services/.test(home));
});

console.log('\nThe worker is never shown a stale decision');
check('resolving the incoming-request popup tells the dashboard list to refetch', () => {
    // The popup lives outside the list and answered the booking without it, so
    // the list kept offering Accept/Reject on an accepted job — one stray tap
    // from cancelling work already taken.
    assert.ok(/BOOKING_ACTION_TAKEN/.test(frontend('components', 'GlobalAlarm.jsx')),
        'the popup must broadcast when it resolves a booking');
    assert.ok(/addEventListener\('BOOKING_ACTION_TAKEN'/.test(
        frontend('modules', 'provider', 'components', 'RecentBookingsList.jsx')),
        'the bookings list must refetch on that broadcast');
});

console.log('\nA booking is only called complete when it is');
const server = backend('controllers', 'bookingController.js');
check('the server answers a completion request on a started job with an OTP', () => {
    // Completion runs through verifyEndOTP alone, because that is where
    // commission, payout and the wallet are touched.
    assert.ok(/newStatus === 'completed' && booking\.status === 'started'/.test(server));
    assert.ok(/status: 'started' \/\/ Keep as started until verified/.test(server));
});
check('the worker is told what actually happened, not what was requested', () => {
    const list = frontend('modules', 'provider', 'components', 'RecentBookingsList.jsx');
    // Announcing "Booking Completed" when the server kept the job started told
    // the worker the job was done and paid when it was neither.
    assert.ok(/const granted = res\.data\?\.status/.test(list),
        'the status response must be read');
    assert.ok(/granted !== newStatus/.test(list),
        'a transition the server did not grant must not be reported as success');
});


console.log('\nThe customer is never charged something the checkout did not show');
check('the public config reads the same distance config that bills', () => {
    // These were two separate defaults for one setting: with no config row
    // saved, the public config said disabled while booking creation said
    // enabled, so a Partner booking quietly gained a travel charge the
    // checkout never displayed. One source, or they drift again.
    const home = backend('controllers', 'homeController.js');
    assert.ok(/distanceCharge: await DistanceChargeService\.getConfig\(\)/.test(home),
        'the public config must read the real distance config');
    assert.ok(!/distanceCharge: config\.distance_charge_config \|\| \{ enabled: false/.test(home),
        'it must not carry its own competing default');
});

check('the service and the public surface cannot disagree', () => {
    const service = backend('services', 'DistanceChargeService.js');
    // One default, in the service that actually applies the charge.
    const defaults = service.match(/enabled:\s*(true|false)/);
    assert.ok(defaults, 'the service must state a default');
});

console.log('\nA card leaves the worker\'s list the moment they act on it');
const list = () => frontend('modules', 'provider', 'components', 'RecentBookingsList.jsx');

check('the list does not hold one branch waiting for another', () => {
    // mode="wait" held the whole list until the outgoing branch finished
    // exiting, so a card the worker had just accepted stayed on screen.
    assert.ok(!/<AnimatePresence mode="wait">/.test(list()),
        'the bookings list must not use mode="wait"');
});

check('branches are keyed so they can be told apart', () => {
    const src = list();
    assert.ok(/key="loading"/.test(src), 'the loading branch needs an identity');
    assert.ok(/key="list"/.test(src), 'the card grid needs an identity');
});

check('a card that leaves the filtered list unmounts at once', () => {
    // Its exit animation never completed inside a removing parent, so the card
    // lingered — still offering Accept and Reject on an accepted booking, which
    // is one tap from cancelling work already taken.
    const card = list().match(/<motion\.div key=\{req\._id\}[^>]*/);
    assert.ok(card, 'the booking card must still be there');
    assert.ok(!/exit=/.test(card[0]), 'a booking card must not animate out');
    assert.ok(!/\blayout\b/.test(card[0]), 'layout animation stalls the unmount');
});

console.log(`\n${passed} Sewak booking checks passed.\n`);
