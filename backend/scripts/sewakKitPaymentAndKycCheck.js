/**
 * A Sewak could not get from registration to buying their starter kit:
 *
 * 1. KYC could not be approved: approval asked for an 'aadhaar' document, but
 *    registration saves 'aadhaar_front' / 'aadhaar_back', and the admin
 *    checklist did not list Aadhaar or PAN at all. A document sent with no
 *    file was saved as verified, so a Sewak could also verify their own.
 * 2. The kit could not be paid for: the store sent a "simulated" payment the
 *    server refuses. The real path took the amount from the app and never
 *    compared it with the price, and placing the order also debited the
 *    wallet. POST /kit-store/order placed one with no payment at all.
 *
 *   node scripts/sewakKitPaymentAndKycCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { requiredDocVerified, missingRequiredDocs } = require('../utils/sewakKycDocs');

const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };
const doc = (id, status = 'verified') => ({ id, status });

console.log('\nKYC: the documents registration really saves can be approved');
check('Aadhaar = front photo, plus the back when one was given (or an older single document)', () => {
    assert.strictEqual(requiredDocVerified([doc('aadhaar_front'), doc('aadhaar_back')], 'aadhaar'), true);
    assert.strictEqual(requiredDocVerified([doc('aadhaar_front')], 'aadhaar'), true);
    assert.strictEqual(requiredDocVerified([doc('aadhaar_front'), doc('aadhaar_back', 'pending')], 'aadhaar'), false);
    assert.strictEqual(requiredDocVerified([doc('aadhaar')], 'aadhaar'), true);
    assert.strictEqual(requiredDocVerified([], 'aadhaar'), false);
});
check('approval needs Aadhaar, PAN and the live video', () => {
    const all = [doc('aadhaar_front'), doc('aadhaar_back'), doc('pan'), doc('live_video')];
    assert.deepStrictEqual(missingRequiredDocs(all), []);
    assert.deepStrictEqual(missingRequiredDocs([doc('aadhaar_front'), doc('live_video'), doc('pan', 'rejected')]), ['pan (rejected)']);
    assert.deepStrictEqual(missingRequiredDocs([]), ['aadhaar (missing)', 'pan (missing)', 'live_video (missing)']);
});
check('both approval paths and the admin button use that rule', () => {
    const admin = read('backend', 'controllers', 'adminController.js');
    assert.ok(/require\('\.\.\/utils\/sewakKycDocs'\)/.test(admin));
    assert.ok(/const notVerified = missingRequiredDocs\(docs\);/.test(admin));
    assert.ok(/SEWAK_REQUIRED_DOCS\.every\(reqId => requiredDocVerified\(sewak\.documents \|\| \[\], reqId\)\)/.test(admin));
    const page = read('frontend', 'src', 'modules', 'admin', 'pages', 'AdminVerifySewak.jsx');
    assert.ok(/ok\("aadhaar_front"\) && \(!docs\.some\(d => d\.id === "aadhaar_back"\) \|\| ok\("aadhaar_back"\)\)/.test(page));
});
check('the admin checklist lists Aadhaar (front / back) and PAN', () => {
    const page = read('frontend', 'src', 'modules', 'admin', 'pages', 'AdminVerifySewak.jsx');
    assert.ok(/\{ id: 'aadhaar_front', label: 'Aadhaar \(Front\)', required: true \}/.test(page));
    assert.ok(/\{ id: 'aadhaar_back', label: 'Aadhaar \(Back\)'/.test(page));
    assert.ok(/\{ id: 'pan', label: 'PAN Card', required: true \}/.test(page));
});
check('no document is saved as verified on upload — every one waits for admin review', () => {
    const provider = read('backend', 'controllers', 'providerController.js');
    const fn = provider.slice(provider.indexOf('const uploadDocument'), provider.indexOf('const uploadDocument') + 3000);
    assert.ok(/url: req\.file \? req\.file\.path : 'API_Verified',\s*status: 'pending',/.test(fn));
    assert.ok(!/status: req\.file \? 'pending' : 'verified'/.test(fn));
});

console.log('\nKit payment: real Razorpay, priced by the server, paid once, charged once');
const kit = read('backend', 'controllers', 'kitOrderController.js');
const pay = read('backend', 'controllers', 'paymentController.js');
const routes = read('backend', 'routes', 'kitStoreRoutes.js');
const store = read('frontend', 'src', 'modules', 'provider', 'pages', 'SewakKitStore.jsx');
check('one pricing rule for the quote, the payment and the order', () => {
    assert.ok(/const priceKitOrder = async \(provider, body\) =>/.test(kit));
    assert.strictEqual((kit.match(/await priceKitOrder\(provider, req\.body\)/g) || []).length, 3, 'quote, payment order, placed order');
});
check('the Razorpay order is for the server price, with what is bought stored on it', () => {
    const fn = kit.slice(kit.indexOf('const createKitPaymentOrder'), kit.indexOf('const placeOrder'));
    assert.ok(/createRecordedOrder\(\{\s*amount: downPaymentAmount,\s*purpose: 'kit',\s*providerId: provider\._id,\s*meta: \{/.test(fn));
    assert.ok(/router\.post\('\/payment-order', protect, createKitPaymentOrder\)/.test(routes));
});
check('the order placed is the one paid for, and only for the full amount due', () => {
    const fn = pay.slice(pay.indexOf('const verifyKitOrderPayment'));
    assert.ok(/const meta = claim\.order\.meta \|\| \{\};/.test(fn) && /req\.body = \{\s*orderType: meta\.orderType,/.test(fn));
    assert.ok(/req\.kitPayment = \{[\s\S]{0,160}amount: claim\.order\.amount/.test(fn));
    assert.ok(/if \(paid && Math\.round\(Number\(paid\.amount\) \* 100\) !== Math\.round\(downPaymentAmount \* 100\)\)/.test(kit));
});
check('paid, then the price changed or the item was switched off: the order is still placed as paid for', () => {
    const fn = kit.slice(kit.indexOf('const createKitPaymentOrder'), kit.indexOf('const placeOrder'));
    assert.ok(/frozen: \{\s*categoryId: String\(draft\.categoryId\),[\s\S]{0,900}downPaymentAmount,\s*remainingAmount\s*\}/.test(fn));
    assert.ok(/frozen: meta\.frozen \|\| null/.test(pay));
    assert.ok(/const frozen = paid && paid\.frozen && Math\.round\(Number\(paid\.frozen\.downPaymentAmount\) \* 100\) === Math\.round\(Number\(paid\.amount\) \* 100\)/.test(kit));
});
check('a Razorpay payment is not taken again from the wallet', () => {
    assert.ok(/if \(downPaymentAmount > 0 && !paid\) \{/.test(kit));
});
check('no order without payment: the old POST /kit-store/order is gone', () => {
    assert.ok(!/router\.post\('\/order'/.test(routes));
});
check('the store opens the real Razorpay checkout (no simulated payment)', () => {
    assert.ok(!/isSimulated: true/.test(store));
    assert.ok(/API\.post\("\/kit-store\/payment-order"/.test(store));
    assert.ok(/new window\.Razorpay\(\{/.test(store) && /await API\.post\("\/payment\/verify-kit-order", response\)/.test(store));
    assert.ok(/ondismiss: \(\) => \{ setPlacing\(false\);/.test(store));
});

console.log(`\n${passed} sewak kit payment and KYC checks passed.`);
