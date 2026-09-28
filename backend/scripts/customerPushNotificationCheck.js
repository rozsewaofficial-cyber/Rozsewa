/**
 * Customer-reported bug: admin broadcasts landed in the in-app Notification
 * Center (the bell icon list) but never as a real OS push notification.
 *
 * The push pipeline itself was already correct and identical for
 * customers and providers — broadcastController.sendNotificationBroadcast
 * calls notifyUser(), which writes the in-app record AND attempts an FCM
 * push regardless of role (backend/config/notificationService.js:386-400).
 * What was actually missing was any way for a customer to know push was
 * even a feature, opt in via an explicit gesture (which browsers respect
 * far more than an automatic call on login), or find out their browser had
 * silently blocked it — the Provider app already had exactly this UI
 * (ProviderProfile.jsx's "Push Notifications" / "Send Test" section), the
 * customer app had nothing equivalent.
 *
 * This pins that the customer Profile screen now offers the same
 * opt-in/test flow, reusing the shared syncFCMToken from AuthContext and
 * the existing role-agnostic /notifications/fcm-tokens/test endpoint
 * (no backend change needed — notifyUser already branches correctly on
 * userRole).
 *
 *   node scripts/customerPushNotificationCheck.js
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

const notificationController = read('controllers/notificationController.js');
const notificationService = read('config/notificationService.js');
const profileUi = feRead('modules/user/pages/Profile.jsx');
const providerProfileUi = feRead('modules/provider/pages/ProviderProfile.jsx');

console.log('\nThe backend push pipeline is already role-agnostic — confirming, not changing it');

check('testFCMNotification routes through the same notifyUser pipeline for every role, not a provider-only path', () => {
    const fn = sliceFn(notificationController, 'const testFCMNotification');
    assert.ok(/userRole = req\.user\.role/.test(fn));
    assert.ok(/userRole,/.test(fn), 'the caller\'s own role, whatever it is, must reach notifyUser');
});

check("notifyUser attempts the FCM push unconditionally, before any role branching that follows it", () => {
    const fn = sliceFn(notificationService, 'async function notifyUser');
    const pushBlock = fn.slice(fn.indexOf('Channel 3: Firebase Push'));
    assert.ok(/await sendNotificationToUser\(userId, userRole, \{/.test(pushBlock));
});

console.log('\nThe customer Profile screen now offers the same opt-in/test flow the provider app already had');

check('Profile.jsx reuses the shared syncFCMToken from AuthContext, not a duplicated implementation', () => {
    assert.ok(/const \{ user, logout, syncFCMToken \} = useAuth\(\)/.test(profileUi));
    assert.ok(/await syncFCMToken\(\);/.test(profileUi));
});

check('a denied browser permission shows guidance instead of silently failing, same wording as the provider screen', () => {
    const fn = sliceFn(profileUi, 'const handleTestNotification');
    assert.ok(/Notification\.permission === 'denied'/.test(fn));
    assert.ok(/Please enable notifications for this site in your browser settings/.test(fn));
    assert.ok(fn.includes(sliceFn(providerProfileUi, 'const handleTestNotification').match(/Please enable notifications[^"]*/)[0]),
        'the customer and provider guidance text should read identically, not drift into two different messages');
});

check('the test call hits the existing role-agnostic endpoint, not a new customer-only one', () => {
    assert.ok(/API\.post\("\/notifications\/fcm-tokens\/test"\)/.test(profileUi));
});

check('a visible "Push Notifications" section with a Send Test button is actually rendered on the page', () => {
    assert.ok(/Push Notifications/.test(profileUi));
    assert.ok(/onClick=\{handleTestNotification\}/.test(profileUi));
});

console.log(`\n${passed} customer-push-notification checks passed.\n`);
