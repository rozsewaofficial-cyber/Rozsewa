/**
 * Partner app, notebook page 3: direct-service signup only, Razorpay opened
 * with the key the server raised the order under, alert sound on iPhone, and
 * the home page offering jobs and leads to accept.
 *
 *   node scripts/partnerNotebookCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const src = (p) => read('frontend', 'src', ...p.split('/'));

check('signup offers direct service only: Service Expert / Service Agency', () => {
    const models = src('modules/provider/data/partnerModels.js');
    assert.ok(models.includes('const OFFERED_AT_SIGNUP = ["service_provider"];'));
    assert.ok(models.includes('OFFERED_AT_SIGNUP.includes(m.id)'));
    // The other models stay defined for partners already registered under them.
    assert.ok(models.includes('id: "taxi"') && models.includes('ALL_PARTNER_MODELS'));
});

check('no screen opens Razorpay with a built-in test key', () => {
    const files = [
        'modules/provider/pages/ProviderSubscriptions.jsx', 'modules/provider/pages/ProviderBannerPromotion.jsx',
        'modules/provider/pages/ProviderRegister.jsx', 'modules/user/pages/Wallet.jsx', 'modules/user/pages/LiveTracking.jsx',
        'modules/user/pages/Scrap/AddScrap.jsx', 'modules/user/pages/BazaarOfferChat.jsx', 'modules/user/pages/Checkout.jsx', 'lib/welfareRazorpay.js'
    ];
    for (const f of files) {
        const s = src(f);
        assert.ok(!s.includes('rzp_test_8sYbz'), `${f} still has the test key`);
        assert.ok(/key: (order|orderRes\.data)\.key \|\| import\.meta\.env\.VITE_RAZORPAY_KEY_ID/.test(s), `${f} does not use the order's key`);
    }
});

check('every recorded order carries the key it was raised under', () => {
    const pay = read('backend', 'controllers', 'paymentController.js');
    assert.ok(pay.includes('return { ...order, key: process.env.RAZORPAY_KEY_ID };'));
    assert.ok(pay.includes('res.json({ ...order, key: process.env.RAZORPAY_KEY_ID });'));
});

check('the alarm can be unlocked with one tap on a phone, and the card asks for it', () => {
    const ctx = src('context/SocketContext.jsx');
    assert.ok(ctx.includes("['click', 'touchend', 'pointerup']"), 'iPhone counts a finished tap');
    assert.ok(ctx.includes('unlockSound') && ctx.includes('soundUnlocked'));
    const card = src('modules/provider/components/PermissionsCard.jsx');
    assert.ok(card.includes('key: "sound"') && card.includes('await unlockSound?.()'));
});

check('the push asks the phone for an alert sound and priority', () => {
    const svc = read('backend', 'config', 'notificationService.js');
    assert.ok(svc.includes("'apns-push-type': 'alert'") && svc.includes("sound: 'default'"));
    assert.ok(svc.includes("'interruption-level': 'time-sensitive'") && svc.includes("new Set(['booking', 'lead', 'sos'])"));
    assert.ok(svc.includes('silent: false'));
    const sw = read('frontend', 'public', 'firebase-messaging-sw.js');
    assert.ok(sw.includes('silent: false') && sw.includes('requireInteraction'));
});

check('the partner home offers Insta Work jobs and leads to accept or reject', () => {
    const home = src('modules/provider/pages/ProviderDashboard.jsx');
    assert.ok(home.includes('LeadsHomeSection') && home.includes('PermissionsBanner'));
    assert.ok(fs.existsSync(path.join(root, 'frontend', 'src', 'modules', 'provider', 'components', 'LeadsHomeSection.jsx')));
});

check('registration fills the PIN code box on Auto-Locate and shows the live camera', () => {
    const reg = src('modules/provider/pages/ProviderRegister.jsx');
    assert.ok(reg.includes('pincode: (String(addr.postcode') && reg.includes('data-pincode'));
    assert.ok(reg.includes('<video ref={videoRef} autoPlay playsInline muted'));
});

check('a registration reloaded half-way keeps the located point instead of saving [0, 0]', () => {
    const reg = src('modules/provider/pages/ProviderRegister.jsx');
    assert.ok(reg.includes('sessionStorage.getItem("providerRegCoords")') && reg.includes('sessionStorage.setItem("providerRegCoords"'));
    assert.ok(reg.includes('sessionStorage.removeItem("providerRegCoords")'), 'cleared once registration is done');
});

check('every lead event the app logs is a valid LeadActivity event (declines and meeting OTPs were failing silently)', () => {
    const LeadActivity = require('../models/LeadActivity');
    const valid = LeadActivity.schema.path('event').enumValues;
    for (const e of ['LEAD_DECLINED', 'LEAD_MEET_VERIFIED']) assert.ok(valid.includes(e), e);
    const lead = read('backend', 'controllers', 'leadController.js');
    const logged = [...lead.matchAll(/logActivity\([^)]*'([A-Z_]{5,})'/g)].map(m => m[1]);
    for (const e of logged) assert.ok(valid.includes(e), `${e} is logged but not a valid event`);
});

check('the nested pop-up blocks on the services page have their own keys', () => {
    const page = src('modules/provider/pages/ProviderServices.jsx');
    assert.ok(page.includes('<AnimatePresence key="sewak-add-presence">') && page.includes('<AnimatePresence key="view-service-presence">'));
});

console.log(`\n${passed} partner notebook checks passed.`);
