/**
 * Report: the login page's "Continue with Google" button needed fixing.
 * Google's own button is an un-styleable iframe: in the half-width cell it
 * left-aligned and truncated to "Continue w…", with a different height from
 * the Apple button beside it. Now a tile styled like the Apple one is drawn,
 * and Google's real button sits invisibly over it (sized in pixels — the
 * "100%" width the old code passed is not a valid GoogleLogin width), so
 * a tap still starts Google sign-in with the same credential callback.
 *
 *   node scripts/googleLoginTileCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'CustomerLogin.jsx'), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

check('Google tile wraps the real GoogleLogin, invisible, in a pixel width', () => {
    const comp = page.slice(page.indexOf('const GoogleSignInTile'), page.indexOf('const CustomerLogin'));
    assert.ok(/opacity-0/.test(comp) && /<GoogleLogin\s/.test(comp));
    assert.ok(/width=\{String\(width\)\}/.test(comp), 'GoogleLogin needs a pixel width, not "100%"');
    assert.ok(/offsetWidth/.test(comp));
});
check('the credential still reaches the existing handler', () => {
    assert.ok(/<GoogleSignInTile\s+redirect=\{googleRedirect\}\s+onSuccess=\{handleGoogleSuccess\}/.test(page));
    // iPhone: Google's popup never reports back, so redirect mode with a nonce
    assert.ok(/ux_mode: \"redirect\", login_uri: redirect\.loginUri, nonce: redirect\.nonce/.test(page));
    assert.ok(/key=\{redirect\?\.nonce/.test(page), 'button must be redrawn when the nonce changes');
    assert.ok(/\/auth\/google\/start/.test(page) && /loginWithGoogleCode\(code, nonce\)/.test(page));
    assert.ok(/loginWithGoogle\(credentialResponse\.credential\)/.test(page));
});
check('Google and Apple tiles share one fixed height', () => {
    assert.ok((page.match(/\bh-11\b/g) || []).length >= 3);
    assert.ok(!/width="100%"/.test(page));
});
console.log(`\n${passed} google-login-tile checks passed.\n`);
