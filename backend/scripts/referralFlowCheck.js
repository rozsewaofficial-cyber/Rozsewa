/**
 * Refer & Earn links an invited friend and reports each referral honestly.
 *
 * Signing up never carried a referral code: the shared message was the bare
 * site address, the signup form had no code field and no signup method
 * (password, OTP, Google, Apple) accepted one. Invited friends were never
 * linked to whoever invited them, so nobody earned. Referrals the anti-fraud
 * checks stopped were also counted and shown as "rewarded".
 *
 *   node scripts/referralFlowCheck.js
 *
 * Reads the source; no database needed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const lib = read('frontend', 'src', 'lib', 'referral.js');
const auto = read('frontend', 'src', 'components', 'ReferralAutoApply.jsx');
const app = read('frontend', 'src', 'App.jsx');
const login = read('frontend', 'src', 'modules', 'user', 'pages', 'CustomerLogin.jsx');
const page = read('frontend', 'src', 'modules', 'user', 'pages', 'ReferEarn.jsx');
const coin = read('backend', 'controllers', 'coinController.js');

check('the invite carries the code in a link', () => {
    assert.ok(/\/login\?ref=\$\{encodeURIComponent/.test(lib));
    assert.ok(/inviteLink\(data\.referralCode\)/.test(page));
});
check('a ?ref= code is kept from whatever page the link opens', () => {
    assert.ok(/captureReferralFromUrl\(\);/.test(app));
    assert.ok(/searchParams|URLSearchParams\(window\.location\.search\)\.get\("ref"\)/.test(lib));
});
check('signup opens with the code filled in, and it can be typed', () => {
    assert.ok(/invitedWith \? "signup"/.test(login));
    assert.ok(/useState\(\(\) => getPendingReferral\(\)\)/.test(login));
    assert.ok(/setReferralCode\(savePendingReferral\(e\.target\.value\)\)/.test(login));
});
check('the code is applied after any customer sign-in, then dropped', () => {
    assert.ok(/<ReferralAutoApply \/>/.test(app));
    assert.ok(/role !== "customer"/.test(auto));
    assert.ok(/API\.post\("\/coins\/referral\/apply", \{ code, deviceId: getDeviceId\(\) \}\)/.test(auto));
    assert.ok(/clearPendingReferral\(\);\s*toast\.success/.test(auto));
});
check('a blocked referral is not counted or shown as rewarded', () => {
    assert.ok(/\$not: \[\{ \$ifNull: \['\$referralBlockedReason', false\] \}\]/.test(coin));
    assert.ok(/status: blocked \? 'blocked'/.test(coin));
    assert.ok(/blocked: \{\s*label: "Not eligible"/.test(page) && /STATUS\[statusOf\(referral\)\]/.test(page));
});
check('the referrer\'s device is recorded, and the client IP is the first forwarded entry', () => {
    assert.ok(/user\.signupDeviceId = String\(req\.query\.deviceId\)/.test(coin));
    assert.ok(/params: \{ deviceId: getDeviceId\(\) \}/.test(page));
    assert.ok(/x-forwarded-for'\] \|\| ''\)\.split\(','\)\[0\]\.trim\(\)/.test(coin));
});

console.log(`\n${passed} referral checks passed.`);
