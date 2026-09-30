/**
 * Customer complaint: "insta work kaha hai" — the Insta Work CTA was
 * missing from the home screen entirely.
 *
 * GET /insta/services is deliberately public — instaRoutes.js's own
 * comment says "Service discovery is public so the Insta menu can render
 * before login." But Index.jsx's effect that decides whether to show the
 * CTA had `if (!user) { setInstaEnabled(false); return; }` before ever
 * calling it — so no signed-out visitor's browser ever made the request,
 * and instaEnabled stayed false forever for every guest, no matter how
 * many Insta services were configured for their city.
 *
 *   node scripts/instaWorkGuestVisibilityCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

console.log('\nThe backend already intends Insta discovery to work before login');

check('GET /insta/services has no protect middleware', () => {
    const routes = read('routes/instaRoutes.js');
    assert.ok(/router\.get\('\/services', customer\.getServices\);/.test(routes),
        'no protect between the path and the handler — the other insta routes all have one');
});

console.log('\nThe home page actually asks it, guest or not');

check('the availability check no longer bails out before the fetch for a signed-out visitor', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    const fn = page.slice(page.indexOf('// Whether to offer Insta Work here at all'), page.indexOf('const bannerScrollRef') === -1 ? page.length : page.indexOf('}, [user, userCity]);') + 25);
    assert.ok(!/if \(!user\) \{ setInstaEnabled\(false\); return; \}/.test(fn),
        'this line skipped the request entirely for a guest, contradicting the public backend route');
    assert.ok(/API\.get\(`\/insta\/services/.test(fn), 'the fetch itself is still there, just no longer gated');
});

console.log(`\n${passed} insta-work-guest-visibility checks passed.\n`);
