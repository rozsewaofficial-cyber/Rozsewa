/**
 * What admin sends a Sewak or partner (KYC approved/rejected, a document
 * approved/rejected, account suspended) reaches them in the app — saved to
 * their notifications, shown live and pushed — not as a phone push only. An
 * unverified Sewak (the one getting KYC messages) can open Notifications, and
 * tapping a message opens where it points (KYC → documents).
 *
 *   node scripts/adminNotifiesProvidersCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const admin = read('backend', 'controllers', 'adminController.js');
const guard = read('frontend', 'src', 'components', 'ProtectedRoute.jsx');
const nav = read('frontend', 'src', 'modules', 'provider', 'components', 'ProviderTopNav.jsx');
const list = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderNotifications.jsx');

check('admin messages to partners/Sewaks go through notifyUser (in-app + live + push)', () => {
    assert.ok(/const notifyProviderInApp = \(providerId, \{ title, body, data = \{\} \}\) => \{[\s\S]{0,600}notifyUser\(\{ userId: providerId, userRole: 'provider', title, message: body, type: 'system'/.test(admin));
    assert.ok(!/sendNotificationToUser\((provider|sewak)\._id, 'provider'/.test(admin), 'no push-only admin messages left');
    assert.ok((admin.match(/notifyProviderInApp\((provider|sewak)\._id, \{/g) || []).length >= 10);
});
check('KYC/document messages open the documents page', () => {
    assert.ok(admin.includes("const link = data.link || (data.type === 'kyc' ? '/provider/documents' : undefined);"));
});
check('an unverified Sewak/partner can open Notifications and sees the bell', () => {
    assert.strictEqual((guard.match(/location\.pathname !== "\/provider\/notifications"/g) || []).length, 2);
    assert.ok(/\{\/\* Always shown: admin's KYC\/document messages come before approval\. \*\/\}\s*<Link to="\/provider\/notifications"/.test(nav));
});
check('tapping a notification follows its saved link first', () => {
    assert.ok(list.includes('const savedLink = typeof notif.link === "string" && notif.link.startsWith("/provider") ? notif.link : "";'));
});

check('withdrawal and benefit-request decisions also reach the app (not push only)', () => {
    const wd = read('backend', 'controllers', 'withdrawalController.js');
    const br = read('backend', 'controllers', 'benefitRequestController.js');
    assert.ok(/notifyUser\(\{\s*userId: withdrawal\.providerId,\s*userRole: 'provider',/.test(wd));
    assert.ok(!/sendNotificationToUser\(withdrawal\.providerId/.test(wd));
    assert.ok(/notifyUser\(\{\s*userId: request\.applicantId,\s*userRole: request\.applicantRole === 'provider' \? 'provider' : 'user',/.test(br));
    assert.ok(!/sendNotificationToUser\(request\.applicantId/.test(br));
});

console.log(`\n${passed} admin-to-provider notification checks passed.`);
