/**
 * A buyer can pay for a seller's contact two ways: from their wallet, or
 * through the gateway. What "unlocked" means is not the payment — it is a
 * successful BazaarUnlockTransaction, which is the only thing the contact
 * endpoint looks for before handing over a phone number.
 *
 * The wallet path wrote that row. The gateway path flipped a flag on the offer
 * and nothing else, so a buyer who paid by card was charged and still told
 * "Contact details locked". The two paths had drifted because each carried its
 * own copy of what unlocking meant.
 *
 * These pin the shape that prevents it happening again: one definition of
 * unlocking, one definition of the fee, and both paths going through them.
 *
 *   node scripts/bazaarUnlockCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const bazaar = read('controllers/bazaarController.js');
const payment = read('controllers/paymentController.js');

console.log('\nUnlocking means one thing');

check('there is a single place that records an unlock', () => {
    assert.ok(/const finaliseUnlock = async/.test(bazaar), 'finaliseUnlock exists');
    const fn = bazaar.slice(bazaar.indexOf('const finaliseUnlock'), bazaar.indexOf('const templateScopeFor'));
    assert.ok(/BazaarUnlockTransaction\.create/.test(fn),
        'it writes the row the contact endpoint actually checks');
    assert.ok(/isLeadUnlockedByBuyer: true/.test(fn), 'and the older flag alongside it');
});

check('both ways of paying go through it', () => {
    assert.ok(/finaliseUnlock\(\{/.test(bazaar), 'the wallet path calls it');
    assert.ok(/finaliseUnlock\(\{/.test(payment), 'and so does the gateway path');
    // The gateway path used to do this and only this.
    const fn = payment.slice(payment.indexOf('const verifyBazaarPayment'), payment.indexOf('module.exports.verifyBazaarPayment'));
    assert.ok(!/offer\.isLeadUnlockedByBuyer = true;[\s\S]{0,40}await offer\.save\(\);[\s\S]{0,120}res\.json/.test(fn),
        'setting the flag is no longer the whole of it');
});

check('a gateway unlock records what was actually paid', () => {
    const fn = payment.slice(payment.indexOf('const verifyBazaarPayment'), payment.indexOf('module.exports.verifyBazaarPayment'));
    assert.ok(/amount: claim\.order\.amount/.test(fn),
        "the amount comes off the claimed order, not the request");
    assert.ok(/paymentMode: 'razorpay'/.test(fn), 'and is recorded as a gateway payment');
});

check('paying twice does not unlock twice', () => {
    const fn = bazaar.slice(bazaar.indexOf('const finaliseUnlock'), bazaar.indexOf('const templateScopeFor'));
    assert.ok(/if \(existing\) return \{ record: existing, alreadyUnlocked: true \}/.test(fn),
        'an existing unlock is returned rather than duplicated');
});

console.log('\nThe fee means one thing');

check('there is a single place that resolves it', () => {
    assert.ok(/const resolveUnlockFee = async/.test(bazaar), 'resolveUnlockFee exists');
    // It used to be copied inline wherever it was needed.
    assert.ok(!/bazaarCommissionFee \?\? 20;[\s\S]{0,80}bazaarCommissionFee \?\? 20;/.test(bazaar),
        'and not copied from place to place');
});

check('it goes ad override, then subcategory, then global', () => {
    const fn = bazaar.slice(bazaar.indexOf('const resolveUnlockFee'), bazaar.indexOf('const finaliseUnlock'));
    assert.ok(fn.indexOf('ad.unlockFee') < fn.indexOf('subCategoryUnlockFees'), 'the ad wins over its subcategory');
    assert.ok(fn.indexOf('subCategoryUnlockFees') < fn.indexOf('bazaarCommissionFee'), 'which wins over the global fee');
});

check('the ad is loaded with what pricing it needs', () => {
    // A projection that left these out silently charged every subcategory the
    // global fee, with nothing to show anything was wrong.
    assert.ok(/select\('unlockFee status sellerId category subCategory'\)/.test(bazaar),
        'category and subCategory survive the projection');
});

console.log('\nChat templates follow the ad');

check('a template can be pinned to a category and subcategory', () => {
    const model = read('models/BazaarChatTemplate.js');
    assert.ok(/category: \{ type: String/.test(model) && /subCategory: \{ type: String/.test(model),
        'the model carries a scope');
    assert.ok(/default: ''/.test(model), 'and blank means it applies everywhere');
});

check('the picker and the send-gate agree on what applies', () => {
    assert.ok(/const templateScopeFor/.test(bazaar), 'one definition of the scope');
    // Offering a buyer a template and then refusing the message would be worse
    // than not offering it.
    const uses = bazaar.split('templateScopeFor(ad)').length - 1;
    assert.ok(uses >= 2, 'used when listing templates and when accepting one');
});

console.log(`\n${passed} Bazaar unlock checks passed.\n`);
