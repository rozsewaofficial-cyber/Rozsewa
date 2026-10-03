/**
 * Customer report: "partner ka bargaining amount send karne ke baad user pe
 * show karne ka option nahi mil raha hai" — after a provider sent a counter-
 * offer on a bargained booking (IncomingRequestModal.jsx, PATCH
 * /bookings/:id/status with offerDecision: 'counter'), the customer's My
 * Bookings page showed "Accept ₹undefined" and clicking it always failed.
 *
 * Root cause: two separate, incompatible counter-offer systems exist in
 * bookingController.js —
 *   1. The real one providers actually use: booking.partnerCounterOffer /
 *      offerStatus: 'countered', resolved by PUT /bookings/:id with
 *      { counterDecision: 'accept' | 'reject' } (updateBooking).
 *   2. An orphaned one nothing ever creates: booking.negotiation.
 *      providerCounterAmount / negotiation.status, resolved by
 *      PATCH /bookings/:id/accept-counter and /reject-counter.
 *
 * ServiceHistory.jsx's quick-action button read and called system 2 even
 * though every real counter-offer lives in system 1 — so the amount was
 * always undefined and accepting/rejecting always hit "no counter offer to
 * accept" from the backend.
 *
 *   node scripts/bookingCounterOfferAcceptCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');
const beRead = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/ServiceHistory.jsx');
const controller = beRead('controllers/bookingController.js');

console.log('\nThe customer accepts/rejects a counter-offer through the endpoint that actually resolves it');

check('handleAcceptCounter/handleRejectCounter call PUT /bookings/:id with counterDecision', () => {
    assert.ok(/API\.put\(`\/bookings\/\$\{id\}`, \{ counterDecision: 'accept' \}\)/.test(page),
        'accept-counter is a dead endpoint — nothing ever sets the negotiation field it checks');
    assert.ok(/API\.put\(`\/bookings\/\$\{id\}`, \{ counterDecision: 'reject' \}\)/.test(page));
});

check('the real resolution endpoint reads partnerCounterOffer/offerStatus, not the orphaned negotiation field', () => {
    const fn = controller.slice(controller.indexOf('const updateBooking'), controller.indexOf('const updateBooking') + 6000);
    assert.ok(/req\.body\.counterDecision/.test(fn));
    assert.ok(/booking\.partnerCounterOffer/.test(fn));
    assert.ok(/offerStatus: 'countered'/.test(fn), 'the atomic update guard must match the field the provider flow actually sets');
});

console.log('\nThe displayed accept amount comes from the field a real counter-offer actually populates');

check('the quick-action button shows partnerCounterOffer, falling back to the legacy field only if present', () => {
    assert.ok(/Accept ₹\{booking\.partnerCounterTotal \?\? booking\.partnerCounterOffer \?\? booking\.negotiation\?\.providerCounterAmount\}/.test(page),
        'reading only negotiation.providerCounterAmount shows "Accept ₹undefined" for every real counter-offer');
});

console.log(`\n${passed} booking-counter-offer-accept checks passed.\n`);
