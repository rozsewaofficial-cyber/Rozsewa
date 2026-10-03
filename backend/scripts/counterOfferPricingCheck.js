/**
 * "Not fully right yet" follow-up to the counter-offer fix:
 *
 * 1. Price mismatch. The customer accepted a counter of ₹282 and was billed
 *    ₹285. The offer (customerOffer) is a BASE service price — night charge,
 *    GST and platform fee are added on top at checkout — but the partner app
 *    treated it as already including extras (subtracting the night charge from
 *    the offer and adding it back to the counter) while the server added the
 *    night charge a second time on accept, and dropped GST and the platform fee
 *    altogether. Now a counter is a base price too, and one helper (priceAtBase)
 *    prices it the way booking creation does: the same total is stored as
 *    partnerCounterTotal, shown to the customer, and billed on accept.
 * 2. Partner card badge. After a deal it still said "₹220 PROPOSED" (the
 *    customer's opening offer). It now shows what was agreed.
 *
 * This runs the real priceAtBase code on sample bookings, not just text checks.
 *
 *   node scripts/counterOfferPricingCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'bookingController.js'), 'utf8');
const feRead = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');

const grab = (from, to) => controller.slice(controller.indexOf(from), controller.indexOf(to));
// eslint-disable-next-line no-new-func
const { priceAtBase, originalBasePrice } = new Function(
    `${grab('const priceAtBase', 'const hasOverlap')}\nreturn { priceAtBase, originalBasePrice };`
)();

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

// The booking from the live repro: ₹300 service, customer offered ₹220,
// 1% night charge (₹2), ₹40 GST, no platform fee -> stored total ₹262.
const booking = (extra = {}) => ({
    customerOffer: 220, bargainDiscount: 80, gstAmount: 40, platformFee: 0, nightChargeMode: 'percent',
    extraCharges: [{ item: 'Night Charge (1%)', amount: 2 }], ...extra,
});

console.log('\nA counter is priced like a checkout offer, on top of its base price');

check("pricing the customer's own offer reproduces the total they were quoted", () => {
    assert.strictEqual(priceAtBase(booking(), 220).total, 262);
});
check('a counter of ₹280 scales night charge and GST, nothing is added twice or dropped', () => {
    assert.deepStrictEqual(priceAtBase(booking(), 280), { night: 3, gst: 51, fee: 0, total: 334 });
});
check('a flat rupee night charge and a platform fee carry over unchanged', () => {
    const p = priceAtBase(booking({ nightChargeMode: 'flat', extraCharges: [{ item: 'Night Charge (₹50)', amount: 50 }], platformFee: 10 }), 280);
    assert.strictEqual(p.night, 50);
    assert.strictEqual(p.fee, 10);
    assert.strictEqual(p.total, 280 + 50 + 51 + 10);
});
check('the original service price is recovered from the offer and the discount', () => {
    assert.strictEqual(originalBasePrice(booking()), 300);
});

console.log('\nThe quote, the cap and the bill all use that one pricing');

check('the stored quote and the accept bill come from the same helper', () => {
    assert.ok(/booking\.partnerCounterTotal = priceAtBase\(booking, counterAmount\)\.total/.test(controller));
    assert.ok(/const priced = priceAtBase\(booking, booking\.partnerCounterOffer\)/.test(controller));
    assert.ok(/updateFields\.totalAmount = priced\.total/.test(controller));
    assert.ok(/updateFields\.gstAmount = priced\.gst/.test(controller), 'GST must be carried through, not dropped');
});
check('a counter is capped at the original service price, not the all-in price', () => {
    assert.ok(/counterAmount > originalBase/.test(controller));
    assert.ok(!/counterAmount > booking\.originalFixedPrice/.test(controller));
});

console.log('\nThe apps follow the same rule');

check('the partner apps use base prices and send the amount typed, with nothing added', () => {
    for (const f of ['modules/provider/components/IncomingRequestModal.jsx', 'modules/provider/components/RecentBookingsList.jsx']) {
        const src = feRead(f);
        assert.ok(/counterAmount: amt\r?\n/.test(src), `${f} must send exactly the typed amount`);
        assert.ok(!/amt \+ extraChargesAmount/.test(src));
        assert.ok(/bargainDiscount/.test(src));
    }
});
check('the customer is shown the total they would pay, on the same basis as the original price', () => {
    const lt = feRead('modules/user/pages/LiveTracking.jsx');
    assert.ok(/bookingDetails\.partnerCounterTotal \?\? bookingDetails\.partnerCounterOffer/.test(lt));
    assert.ok(/bookingDetails\.totalAmount/.test(lt));
    assert.ok(/Accept ₹\{booking\.partnerCounterTotal/.test(feRead('modules/user/pages/ServiceHistory.jsx')));
});
check('the partner card shows the agreed price, not the opening offer, once a deal is made', () => {
    const rbl = feRead('modules/provider/components/RecentBookingsList.jsx');
    assert.ok(/counter_accepted: \{ price: req\.baseServiceAmount, label: 'Agreed'/.test(rbl));
    assert.ok(/\(req\.baseServiceAmount \|\| req\.customerOffer \|\| 0\) \+ \(req\.bargainDiscount \|\| 0\)/.test(rbl),
        'the struck-through original must not be offer + a discount that the deal has since changed');
});
console.log(`\n${passed} counter-offer-pricing checks passed.\n`);
