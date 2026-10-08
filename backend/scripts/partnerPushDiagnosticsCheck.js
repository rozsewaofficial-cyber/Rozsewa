/**
 * Partner push notifications: why one doesn't arrive can now be seen.
 *
 * A push to an account with no registered device silently did nothing, and
 * the delivery log still said "success". The send now reports what happened
 * (no device / sent / refused, with Firebase's reason), the Test
 * Notification button shows it, and the mobile app has one call to register
 * its device for whoever is signed in — partner sessions are kept apart from
 * customer ones, so an app reading only the customer's session never
 * registered partners.
 *
 *   node scripts/partnerPushDiagnosticsCheck.js
 *
 * Runs the real sender with Firebase and the model stubbed; nothing is sent.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
// Firebase replaced before anything loads it: a check never sends a push.
let fcm;
const fbPath = require.resolve('../config/firebase');
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { messaging: () => ({ sendEachForMulticast: async (msg) => fcm(msg) }) } };
const Provider = require('../models/Provider');
const { sendNotificationToUser } = require('../config/notificationService');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

let target;
Provider.findById = async () => target;
const NotificationLog = require('../models/NotificationLog');
NotificationLog.findOneAndUpdate = async () => ({});
const send = () => sendNotificationToUser('p1', 'provider', { title: 'T', body: 'B', data: { type: 'test' } }, true);

(async () => {
    await check('no device registered: said so (it returned nothing before)', async () => {
        target = { fcmTokens: [], fcmTokenMobile: [] };
        const r = await send();
        assert.strictEqual(r.status, 'no_tokens');
        assert.deepStrictEqual(r.devices, { web: 0, app: 0 });
    });

    await check('sent: counts per device type', async () => {
        target = { fcmTokens: ['w1'], fcmTokenMobile: ['a1'], save: async () => {} };
        fcm = async (m) => ({ successCount: m.tokens.length, failureCount: 0, responses: m.tokens.map(() => ({ success: true })) });
        const r = await send();
        assert.strictEqual(r.status, 'sent');
        assert.strictEqual(r.successCount, 2);
        assert.deepStrictEqual(r.devices, { web: 1, app: 1 });
    });

    await check("refused: Firebase's reason comes back, and a dead token is dropped", async () => {
        target = { fcmTokens: [], fcmTokenMobile: ['bad'], save: async function () { this.saved = true; } };
        fcm = async () => ({ successCount: 0, failureCount: 1, responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }] });
        const r = await send();
        assert.strictEqual(r.status, 'failed');
        assert.deepStrictEqual(r.errors, ['messaging/registration-token-not-registered']);
        assert.deepStrictEqual(target.fcmTokenMobile, []);
    });

    await check('the delivery log no longer says success for a push that was not sent', async () => {
        const src = read('backend', 'config', 'notificationService.js');
        assert.ok(/pushStatus = push\?\.status === 'sent' \? 'success' : `skipped \(\$\{push\?\.status \|\| 'unknown'\}\)`/.test(src));
    });

    await check('Test Notification shows the result; the app can register its device for any signed-in account', async () => {
        const ctrl = read('backend', 'controllers', 'notificationController.js');
        assert.ok(/No device is registered for notifications on this account/.test(ctrl));
        assert.ok(/res\.json\(\{ message: 'Test notification sent', delivered:/.test(ctrl));
        const profile = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderProfile.jsx');
        assert.ok(/data\?\.summary/.test(profile));
        const auth = read('frontend', 'src', 'context', 'AuthContext.jsx');
        assert.ok(/window\.rozsewaRegisterPushToken = /.test(auth) && /platform: "mobile"/.test(auth));
    });

    console.log(`\n${passed} push diagnostics checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
