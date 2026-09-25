/**
 * Coupon note (item 44): a coupon should be selectable as applicable to
 * Partner, Sewak, or Both. Coupons previously had no audience concept at
 * all — targetCategory scoped by service category, nothing scoped by
 * which type of provider the booking was with.
 *
 * These pin: the schema field (mirroring the existing visibleTo enum
 * pattern used for Category/service targeting elsewhere); that
 * createCoupon actually persists it (adminController.js manually
 * destructures+rebuilds the Coupon rather than passing req.body straight
 * through, the same field-whitelist bug class this session has hit
 * before — a new field silently dropped without updating both spots);
 * that the TRUSTED validation in createBooking enforces it using the
 * isSewakBooking flag already resolved earlier in that same function
 * (not a second DB query that could disagree); that the PREVIEW
 * validation in validateCoupon enforces the identical rule so a customer
 * can't be shown a coupon as valid at preview time and then have it
 * silently drop at checkout; and that the admin form/cards expose it.
 *
 *   node scripts/couponApplicableToCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const model = read('models/Coupon.js');
const adminController = read('controllers/adminController.js');
const bookingController = read('controllers/bookingController.js');
const homeController = read('controllers/homeController.js');
const adminUi = feRead('modules/admin/pages/AdminCoupons.jsx');
const checkoutUi = feRead('modules/user/pages/Checkout.jsx');

console.log('\nCoupon carries applicableTo, defaulting to both so every existing coupon keeps working');

check("the enum matches Provider's own providerCategory values, plus 'both'", () => {
    assert.ok(/applicableTo: \{ type: String, enum: \['partner', 'sewak', 'both'\], default: 'both' \}/.test(model));
});

check('createCoupon actually persists it, not silently dropping it like the whitelist bug class this session has hit before', () => {
    const fn = sliceFn(adminController, 'const createCoupon');
    assert.ok(/const \{ code, discount, description, expiryDate, maxUsage, minOrderAmount, maxDiscountAmount, targetCategory, applicableTo \}/.test(fn));
    assert.ok(/applicableTo: \['partner', 'sewak', 'both'\]\.includes\(applicableTo\) \? applicableTo : 'both'/.test(fn));
});

console.log('\nThe trusted booking-creation path enforces it using the already-resolved isSewakBooking flag');

check('matchesProviderType reuses isSewakBooking rather than a second, possibly-disagreeing lookup', () => {
    const fn = sliceFn(bookingController, 'const createBooking');
    assert.ok(/const matchesProviderType = !coupon\.applicableTo \|\| coupon\.applicableTo === 'both'\s*\n\s*\|\| \(coupon\.applicableTo === 'sewak'\) === isSewakBooking;/.test(fn));
});

check('the discount only applies when both the category and the provider-type checks pass', () => {
    const fn = sliceFn(bookingController, 'const createBooking');
    assert.ok(/if \(belongsToCategory && matchesProviderType\)/.test(fn));
});

console.log('\nThe checkout-preview validation enforces the identical rule, so a coupon can\'t look valid at preview and then fail at checkout');

check('validateCoupon accepts providerId and resolves the same providerCategory check', () => {
    const fn = sliceFn(homeController, 'const validateCoupon');
    assert.ok(/const \{ code, amount, serviceId, providerId \} = req\.body;/.test(fn));
    assert.ok(/const isSewakBooking = provider\?\.providerCategory === 'sewak';/.test(fn));
    assert.ok(/\(coupon\.applicableTo === 'sewak'\) !== isSewakBooking/.test(fn));
});

check('Checkout.jsx sends the provider it already has in scope, so the preview check can actually run', () => {
    assert.ok(/providerId: checkoutData\.providerId \|\| null,/.test(checkoutUi));
});

console.log('\nThe admin form and coupon cards expose the new field');

check('the create form has a Partner/Sewak/Both select wired to state and the create payload', () => {
    assert.ok(/applicableTo: "both"/.test(adminUi));
    assert.ok(/value=\{newCoupon\.applicableTo\}/.test(adminUi));
    assert.ok(/setNewCoupon\(\{ \.\.\.newCoupon, applicableTo: e\.target\.value \}\)/.test(adminUi));
    assert.ok(/applicableTo: newCoupon\.applicableTo \|\| "both"/.test(adminUi));
});

check('a Partner-only or Sewak-only coupon shows a badge (a Both coupon shows none, to avoid noise)', () => {
    assert.ok(/coupon\.applicableTo && coupon\.applicableTo !== 'both'/.test(adminUi));
});

console.log(`\n${passed} coupon-applicable-to checks passed.\n`);
