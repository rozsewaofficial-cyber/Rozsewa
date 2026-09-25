/**
 * Night Charge only supported a percentage-of-price, and applied the same
 * way regardless of whether the booking went to a Partner or a Sewak. The
 * admin note asked for a flat-rupee option and an on/off switch per
 * provider type.
 *
 *   node scripts/nightChargeRupeeAndProviderTypeCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker, endMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const end = endMarker ? src.indexOf(endMarker, start + startMarker.length) : -1;
    return end === -1 ? src.slice(start, start + 6000) : src.slice(start, end);
};

const model = read('models/Category.js');
const bookingModel = read('models/Booking.js');
const bookingController = read('controllers/bookingController.js');
const adminController = read('controllers/adminController.js');
const ui = feRead('modules/admin/pages/AdminNightCharge.jsx');
const checkoutUi = feRead('modules/user/pages/Checkout.jsx');

console.log('\nA flat rupee amount is a real, separate field, not a repurposed percent');

check('the category carries a flat amount alongside the percent, not instead of it', () => {
    assert.ok(/nightChargeFlatAmount: \{ type: Number, default: 0 \}/.test(model),
        'switching modes back and forth should not lose whichever figure is not active');
});

check('a booking records which mode actually produced its night charge', () => {
    assert.ok(/nightChargeMode: \{ type: String, enum: \['percent', 'flat', null\], default: null \}/.test(bookingModel));
});

console.log('\nThe booking price engine computes a flat amount as rupees, not payableAmount * percent');

check("flat mode reads the category's flat override, or the global default, directly", () => {
    const fn = sliceFn(bookingController, "// --- 5. Calculate Night Charge", "// --- 6.");
    assert.ok(/if \(chargeType === 'flat'\)/.test(fn));
    assert.ok(/categoryForFee\.nightChargeFlatAmount/.test(fn) && /config\.value\.defaultFlatAmount/.test(fn));
    assert.ok(/nightChargeAmount = Math\.round\(flatAmount\)/.test(fn),
        'not scaled by payableAmount the way the percent branch is');
});

check('a flat charge is added to originalFixedPrice as-is, not re-percented', () => {
    const fn = sliceFn(bookingController, "let originalFixedPrice = subtotal", "if (appliedGstPercent > 0)");
    assert.ok(/appliedNightChargeMode === 'flat'/.test(fn));
    assert.ok(/originalFixedPrice \+= nightChargeAmount;/.test(fn));
});

console.log('\nA renegotiated price does not rescale a flat night charge as if it were a percentage');

check('the counter-offer accept path carries a flat charge over unchanged', () => {
    const fn = sliceFn(bookingController, "if (counterDecision === 'accept')", "} else {");
    assert.ok(/booking\.nightChargeMode === 'flat'\s*\n\s*\? oldAmount/.test(fn));
});

check('reverting to fixed price does the same', () => {
    const fn = sliceFn(bookingController, "req.body.offerDecision === 'fixed_price'", "} else if (req.body.offerDecision === 'counter')");
    assert.ok(/booking\.nightChargeMode === 'flat'\s*\n\s*\? oldAmount/.test(fn));
});

console.log('\nPartner and Sewak are independent on/off switches, checked against the booking\'s actual target');

check('the booking engine gates on isSewakBooking, not a category setting', () => {
    const fn = sliceFn(bookingController, "// --- 5. Calculate Night Charge", "// --- 6.");
    assert.ok(/isSewakBooking \? config\.value\.applyToSewak !== false : config\.value\.applyToPartner !== false/.test(fn));
});

check('a config saved before these switches existed still defaults both on, not off', () => {
    const fn = sliceFn(adminController, 'const DEFAULT_NIGHT_CHARGE_CONFIG', '};');
    assert.ok(/applyToPartner: true/.test(fn) && /applyToSewak: true/.test(fn),
        'an old saved config would otherwise silently turn a charge off for everyone once this shipped');
});

check('the customer-facing checkout preview applies the same gate before showing an estimate', () => {
    assert.ok(/isSewak\s*\n?\s*\? nightChargeConfig\.applyToSewak !== false\s*\n?\s*: nightChargeConfig\.applyToPartner !== false/.test(checkoutUi),
        'otherwise a customer could be shown an estimate the actual booking call would never charge');
});

console.log('\nThe admin screen offers all of it');

check('a charge-type toggle and both figure inputs exist', () => {
    assert.ok(/chargeType: 'flat'/.test(ui) && /chargeType: 'percent'/.test(ui));
    assert.ok(/Default Flat Amount/.test(ui) && /Default Percentage/.test(ui));
});

check('Partner and Sewak each have their own switch', () => {
    assert.ok(/applyToPartner: val/.test(ui) && /applyToSewak: val/.test(ui));
});

check('the category table edits whichever field the active mode reads, not always the percent', () => {
    const fn = sliceFn(ui, 'const handleCategoryUpdate', 'setEditingCategory(null)');
    assert.ok(/nightChargeFlatAmount: value/.test(fn) && /nightChargePercent: value/.test(fn));
});

console.log(`\n${passed} night-charge-rupee-and-provider-type checks passed.\n`);
