/**
 * Posting a Bazaar/Scrap ad used to be free for the seller — only the buyer
 * paid, to unlock contact details. That left no listing fee at all, so this
 * pins the seller-side gate: postAd charges an admin-configurable fee through
 * the same atomic claimPayment every other paid action uses, refuses a stale
 * quote, and records what was actually charged on the ad itself.
 *
 *   node scripts/scrapListingFeeCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const bazaar = read('controllers/bazaarController.js');
const payment = read('controllers/paymentController.js');
const model = read('models/BazaarAd.js');

console.log('\nPosting an ad is a paid action');

check('claimPayment is exported for reuse outside paymentController', () => {
    assert.ok(/module\.exports\.claimPayment = claimPayment;/.test(payment),
        'claimPayment used to be a local const, unreachable from bazaarController');
});

check('postAd charges the seller before creating the ad', () => {
    const fn = bazaar.slice(bazaar.indexOf('exports.postAd'), bazaar.indexOf('exports.getLiveAds'));
    assert.ok(/claimPayment\(req, \{ purpose: 'bazaar', principal: userId \}\)/.test(fn),
        'the same atomic claim every other paid action uses');
    assert.ok(fn.indexOf('claimPayment') < fn.indexOf('new BazaarAd('),
        'the claim happens before the ad is constructed, not after');
});

check('a stale fee quote is refused, not honoured', () => {
    const fn = bazaar.slice(bazaar.indexOf('exports.postAd'), bazaar.indexOf('exports.getLiveAds'));
    assert.ok(/Number\(claim\.order\.amount\) !== Number\(currentListingFee\)/.test(fn),
        'the paid amount is compared against the fee resolved fresh at claim time');
});

check('what was actually charged is recorded on the ad', () => {
    const fn = bazaar.slice(bazaar.indexOf('exports.postAd'), bazaar.indexOf('exports.getLiveAds'));
    assert.ok(/listingFeePaid: claim\.order\.amount/.test(fn),
        'the ad stores the real charged amount, not the current setting');
    assert.ok(/listingFeePaymentId: req\.body\.razorpay_payment_id/.test(fn));
    assert.ok(/listingFeePaid: \{[\s\S]{0,20}type: Number/.test(model), 'the model has a field to hold it');
});

console.log('\nThe fee is admin-configurable, not hardcoded');

check('there is a single place that resolves the listing fee', () => {
    assert.ok(/const resolveListingFee = async/.test(bazaar), 'resolveListingFee exists');
    const fn = bazaar.slice(bazaar.indexOf('const resolveListingFee'), bazaar.indexOf('const finaliseUnlock'));
    assert.ok(/Setting\.findOne\(\{ key: 'bazaar_rules' \}\)/.test(fn),
        'it reads the same admin-configurable settings doc as the unlock fee');
});

check('the settings API exposes and accepts the listing fee', () => {
    assert.ok(/listingFee: 10/.test(bazaar), 'a default is seeded when settings are first created');
    assert.ok(/listingFee !== undefined \? listingFee : 10/.test(bazaar),
        'admin updates can change it, falling back to the default');
});

console.log(`\n${passed} Scrap listing fee checks passed.\n`);
