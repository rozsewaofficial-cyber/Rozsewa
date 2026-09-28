/**
 * Admin complaint: broadcast notifications reach Android but never iOS.
 *
 * This is a Firebase Web Push app (no native iOS/Android shell, no APNs
 * key needed) — confirmed there's no ios/android/Capacitor folder anywhere
 * and no platform filtering in the FCM send code (notificationService.js
 * already builds a valid `apns` payload and merges every stored token,
 * Android and iOS, into one sendEachForMulticast call).
 *
 * The actual break is upstream of the backend entirely: iOS Safari only
 * exposes the Web Push API (Notification.requestPermission + a push
 * subscription) to a site running as an installed, standalone PWA
 * (iOS 16.4+) — a plain Safari tab can never obtain a token, so nothing
 * ever gets saved to fcmTokenMobile for an iOS visitor, independent of
 * anything the Node backend does. There was no manifest, no apple-specific
 * meta tags, and no icon at all — the app was never installable on iOS,
 * and nothing told a Home-Screen-less iOS user why "Send Test" does
 * nothing.
 *
 *   node scripts/iosPushInstallabilityCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRoot = path.join(__dirname, '..', '..', 'frontend');
const feRead = (rel) => fs.readFileSync(path.join(feRoot, ...rel.split('/')), 'utf8');
const feExists = (rel) => fs.existsSync(path.join(feRoot, ...rel.split('/')));

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

console.log('\nThe app is installable on iOS — a prerequisite Web Push has no workaround for');

check('a web app manifest exists with standalone display and real icons', () => {
    assert.ok(feExists('public/manifest.json'), 'iOS Safari (16.4+) reads this to know the site can be installed');
    const manifest = JSON.parse(feRead('public/manifest.json'));
    assert.strictEqual(manifest.display, 'standalone', 'anything else keeps it inside a Safari tab, where Web Push is unavailable');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.some(i => i.sizes === '512x512'),
        'a manifest with no real icon is often treated as not installable');
    for (const icon of manifest.icons) {
        assert.ok(feExists(`public${icon.src}`), `manifest references ${icon.src}, which must actually exist on disk`);
    }
});

check('index.html links the manifest and declares the iOS-specific install meta tags', () => {
    const html = feRead('index.html');
    assert.ok(/<link rel="manifest" href="\/manifest\.json" \/>/.test(html));
    assert.ok(/<meta name="apple-mobile-web-app-capable" content="yes" \/>/.test(html),
        'without this, "Add to Home Screen" opens a plain browser tab, not a standalone app — Web Push still unavailable');
    assert.ok(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/.test(html));
    assert.ok(feExists('public/apple-touch-icon.png'));
});

console.log('\nAn iOS visitor who has not installed the app is told why notifications are off, not left guessing');

for (const [label, file] of [
    ['the customer app', 'src/modules/user/pages/Profile.jsx'],
    ['the provider/Sewak app', 'src/modules/provider/pages/ProviderProfile.jsx']
]) {
    check(`${label} detects iOS-not-installed and shows an install banner instead of a silently-broken Send Test`, () => {
        const page = feRead(file);
        assert.ok(/isIOSNotInstalled/.test(page), 'the page knows the device/install state');
        assert.ok(/display-mode: standalone/.test(page) && /navigator\.standalone/.test(page),
            'both the standard and the older iOS-specific standalone signals are checked');
        assert.ok(/disabled=\{testingNotification \|\| isIOSNotInstalled\}/.test(page),
            'Send Test is disabled here rather than firing a request.requestPermission() that can never succeed');
    });
}

console.log(`\n${passed} ios-push-installability checks passed.\n`);
