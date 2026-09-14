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

console.log(`\n${passed} Sewak booking checks passed.\n`);
