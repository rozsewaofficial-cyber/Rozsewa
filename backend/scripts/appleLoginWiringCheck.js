/**
 * "Apple — Soon" on the login page is now a working Sign in with Apple:
 * button -> Apple JS SDK popup -> identity token -> POST /auth/apple ->
 * verified server-side (see appleIdentityTokenCheck.js) -> same session
 * shape as Google sign-in. It only goes live once Apple credentials exist;
 * until then the button says so and keeps its "Soon" ribbon instead of
 * pretending.
 *
 *   node scripts/appleLoginWiringCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const fe = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');
const be = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const login = fe('modules/user/pages/CustomerLogin.jsx');
const ctx = fe('context/AuthContext.jsx');
const sdk = fe('lib/appleSignIn.js');
const auth = be('controllers/authController.js');

check('the Apple button runs the real flow, not the "coming soon" stub', () => {
    assert.ok(/onClick=\{handleAppleClick\}/.test(login));
    assert.ok(!/Apple Login is coming soon/.test(login));
    assert.ok(/loginWithApple\(apple\.identityToken, apple\.name\)/.test(login));
});
check('unconfigured, it is honest: error message and the Soon ribbon stay', () => {
    assert.ok(/Apple Sign-In is not configured yet/.test(login));
    assert.ok(/\{!appleClientId && \(/.test(login));
});
check('the SDK popup returns the identity token and handles a closed popup quietly', () => {
    assert.ok(/res\?\.authorization\?\.id_token/.test(sdk));
    assert.ok(/usePopup: true/.test(sdk));
    assert.ok(/popup_closed_by_user/.test(sdk));
});
check('AuthContext posts to /auth/apple and builds the same session as Google', () => {
    const fn = ctx.slice(ctx.indexOf('const loginWithApple'), ctx.indexOf('const signup'));
    assert.ok(/API\.post\("\/auth\/apple", \{ identityToken, name \}\)/.test(fn));
    assert.ok(/needsProfileCompletion/.test(fn) && /setAuth\(sessionData\)/.test(fn));
    assert.ok(/loginWithApple,\s+signup,/.test(ctx));
});
check('the server verifies the token before trusting anything in it, and links only verified emails', () => {
    const fn = auth.slice(auth.indexOf('const appleAuth'), auth.indexOf('// @desc    Auth user with OTP'));
    assert.ok(/verifyAppleIdentityToken\(identityToken, process\.env\.APPLE_CLIENT_ID\)/.test(fn));
    assert.ok(/if \(!emailVerified\)/.test(fn));
    assert.ok(/User\.findOne\(\{ appleId \}\)/.test(fn));
    assert.ok(/router\.post\('\/apple', appleAuth\)/.test(be('routes/authRoutes.js')));
});
console.log(`\n${passed} apple-login-wiring checks passed.\n`);
