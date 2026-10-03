/**
 * Issue 8: "partner ka bargaining amount send krne ke baad user pe show krna ka
 * option nhi mil rha hai". The customer-side screens were fine; the counter
 * itself was being thrown away.
 *
 * The provider's decision on a bargained booking (counter / fixed price /
 * accept) was only processed inside `isAccepting && !booking.providerId` —
 * i.e. only for unassigned broadcast bookings. A customer who books a specific
 * shop has the provider attached from the start, so for those bookings the
 * provider's counter got a 200 back, nothing was saved (offerStatus stayed
 * 'pending', partnerCounterOffer null) and the customer never saw an offer.
 *
 * Reproduced live end to end: booked a shop as a customer with an offer,
 * countered as that shop's provider, and the booking never changed. After the
 * fix the counter is stored, the customer sees the Counter-Offer card with the
 * price and expiry, and Accept / Reject both resolve it.
 *
 *   node scripts/directBookingCounterOfferCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'bookingController.js'), 'utf8');
const start = src.indexOf('assignedProviderDecidingBargain');
const block = src.slice(start - 200, start + 1400);

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

check('the decision block also runs for the already-assigned provider of a pending bargain', () => {
    assert.ok(start > 0, 'assignedProviderDecidingBargain must exist');
    assert.ok(/if \(isAccepting && \(!booking\.providerId \|\| assignedProviderDecidingBargain\)\)/.test(block));
});
check('...but only for that provider, and only while the bargain is still open', () => {
    assert.ok(/req\.user\.role === 'provider'/.test(block));
    assert.ok(/booking\.providerId\.toString\(\) === req\.user\._id\.toString\(\)/.test(block));
    assert.ok(/booking\.customerOffer !== null && booking\.customerOffer !== undefined/.test(block));
    assert.ok(/booking\.status === 'pending'/.test(block) && /booking\.offerStatus === 'pending'/.test(block));
});
check('the original broadcast condition is not the only gate any more', () => {
    assert.ok(!/if \(isAccepting && !booking\.providerId\) \{/.test(src));
});
console.log(`\n${passed} direct-booking-counter-offer checks passed.\n`);
