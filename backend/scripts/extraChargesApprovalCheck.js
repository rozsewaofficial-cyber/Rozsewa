/**
 * Extra charges waiting on the customer used to strand the partner: the
 * completion code was issued anyway, the customer read it out, and only then
 * was it refused ("Customer has not approved the extra charges yet") with
 * nothing the partner could do. Now the code waits for the answer, the
 * partner can remind the customer or withdraw the charges, and the customer
 * is pointed at the approval.
 *
 *   node scripts/extraChargesApprovalCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

const ctrl = read('backend', 'controllers', 'bookingController.js');
const routes = read('backend', 'routes', 'bookingRoutes.js');
const partner = read('frontend', 'src', 'modules', 'provider', 'components', 'RecentBookingsList.jsx');
const tracking = read('frontend', 'src', 'modules', 'user', 'pages', 'LiveTracking.jsx');
const history = read('frontend', 'src', 'modules', 'user', 'pages', 'ServiceHistory.jsx');
const socket = read('frontend', 'src', 'context', 'SocketContext.jsx');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('no completion code while extra charges are pending', () => {
    const at = ctrl.indexOf("if (newStatus === 'completed' && booking.status === 'started')");
    const gate = ctrl.indexOf("if (booking.extraStatus === 'pending')", at);
    const issue = ctrl.indexOf('if (!booking.endOTP) {', at);
    assert.ok(at > 0 && gate > at && gate < issue);
});
check('partner can remind the customer (own job only, once a minute)', () => {
    assert.ok(/router\.post\('\/:id\/extra-charges\/remind', protect, remindExtraCharges\)/.test(routes));
    const fn = ctrl.slice(ctrl.indexOf('const remindExtraCharges'), ctrl.indexOf('module.exports'));
    assert.ok(/req\.user\.role !== 'provider' \|\| String\(booking\.providerId\) !== String\(req\.user\._id\)/.test(fn));
    assert.ok(/status\(429\)/.test(fn) && /60 \* 1000/.test(fn));
    assert.ok(/link: `\/tracking\?bookingId=\$\{key\}`/.test(fn));
});
check('partner sees a waiting card with Remind / Remove, not the OTP buttons', () => {
    assert.ok(/data-extra-waiting/.test(partner) && /Remind Customer/.test(partner) && /Remove Charges/.test(partner));
    assert.ok(/\) : req\.extraStatus === 'pending' \? \(\s*<p[^>]*data-complete-blocked="extra"/.test(partner));
    assert.ok(/filter\(c => c\.status !== 'pending'\);\s*await API\.patch\(`\/bookings\/\$\{bookingId\}\/status`, \{ extraCharges: kept, extraStatus: 'none' \}\)/.test(partner));
    assert.ok(/err\.response\?\.data\?\.extraStatus === 'pending'/.test(partner));
});
check('customer: code held until answered, My Bookings points at the approval, live refresh', () => {
    assert.ok(/data-endotp-held/.test(tracking) && /bookingDetails\?\.extraStatus !== "pending" && \(/.test(tracking));
    assert.ok(/booking\.extraStatus === "pending" \? \(/.test(history) && /Approve Extra Charges/.test(history));
    assert.ok(/newSocket\.on\("EXTRA_CHARGES_PENDING"[\s\S]{0,120}dispatchEvent\(new CustomEvent\('EXTRA_CHARGES_PENDING'/.test(socket));
});

check('only the customer approves; only the partner adds or removes', () => {
    assert.ok(/if \(!extraByPartner && !extraByAdmin\) \{\s*return res\.status\(403\)/.test(ctrl));
    assert.ok(/if \(!extraByCustomer && !extraByAdmin\) \{\s*return res\.status\(403\)/.test(ctrl));
    // A partner who booked a job as a customer still answers its charges.
    assert.ok(/const extraByCustomer = [^\n]*&& !extraByPartner;/.test(ctrl));
});
check('approved / declined items cannot be added, edited or removed by the partner', () => {
    assert.ok(/const settled = \(booking\.extraCharges \|\| \[\]\)\.filter\(c => c\.status !== 'pending'\)/.test(ctrl));
    assert.ok(/\.filter\(c => c && c\.status !== 'approved' && c\.status !== 'declined'\)/.test(ctrl));
    assert.ok(/status: 'pending' \}\)\);/.test(ctrl));
    assert.ok(/booking\.extraCharges = \[\.\.\.settled, \.\.\.proposed\]/.test(ctrl));
    assert.ok(!/booking\.extraCharges = req\.body\.extraCharges;/.test(ctrl));
});
check('the provider lock lets the booker answer extra charges, and nothing else', () => {
    assert.ok(/const bookedItAnsweringExtras = booking\.userId && String\(booking\.userId\) === String\(req\.user\._id\)\s*&& \['approved', 'declined'\]\.includes\(req\.body\.extraStatus\)\s*&& Object\.keys\(req\.body\)\.every\(k => k === 'extraStatus'\);/.test(ctrl));
    assert.ok(/booking\.providerId\.toString\(\) !== req\.user\._id\.toString\(\) && !bookedItAnsweringExtras\) \{\s*return res\.status\(403\)\.json\(\{ message: 'This booking is locked by another provider\.' \}\)/.test(ctrl));
});
check('blank names and zero / negative amounts are refused', () => {
    assert.ok(/!c\.item \|\| !Number\.isFinite\(c\.amount\) \|\| c\.amount <= 0/.test(ctrl));
});

console.log(`\n${passed} extra charges approval checks passed.`);
