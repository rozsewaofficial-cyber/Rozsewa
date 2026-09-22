/**
 * The admin Block button flipped `isActive` on a customer's User document, and
 * nothing else in the app ever read it. A blocked customer could still log
 * in, and one already signed in when the block happened kept using the app
 * exactly as before — the flag was cosmetic.
 *
 * These pin the shape that makes blocking real: every way a customer can
 * authenticate checks it before a token is issued, and the session middleware
 * checks it on every request after, so a block takes effect immediately for a
 * session already open. Admin/employee/supervisor accounts share the same
 * User collection and are deliberately left out of the check — this button
 * only exists on the customer registry, and HRM owns staff status separately.
 *
 *   node scripts/userBlockCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const auth = read('controllers/authController.js');
const middleware = read('middleware/authMiddleware.js');
const adminUsersUi = read('../frontend/src/modules/admin/pages/AdminUsers.jsx');
const adminController = read('controllers/adminController.js');

console.log('\nEvery way in checks the block');

check('password login refuses a blocked customer', () => {
    const fn = auth.slice(auth.indexOf('const authUser'));
    assert.ok(/role === 'customer' && user\.isActive === false/.test(fn),
        'the check is scoped to customers, not every account in the User collection');
    assert.ok(fn.indexOf('isActive === false') < fn.indexOf('token: generateToken'),
        'and runs before a token is ever issued');
});

check('OTP login refuses a blocked customer', () => {
    const fn = auth.slice(auth.indexOf('const loginWithOTP'), auth.indexOf('const authUser'));
    assert.ok(/role === 'customer' && user\.isActive === false/.test(fn), 'checked here too');
    assert.ok(/!isProvider/.test(fn), 'and only for the customer branch, not a Provider signing in the same way');
});

check('Google sign-in refuses a blocked customer', () => {
    const fn = auth.slice(auth.indexOf('const googleAuth'), auth.indexOf('const loginWithOTP'));
    assert.ok(/role === 'customer' && user\.isActive === false/.test(fn), 'checked here too');
    assert.ok(/!isNewUser/.test(fn), 'never refuses the account it is about to create');
});

console.log('\nA session already open is cut off too');

check('the session middleware rejects a blocked customer on their next request', () => {
    const fn = middleware.slice(middleware.indexOf('const protect ='), middleware.indexOf('const admin ='));
    assert.ok(/principal\.role === 'customer' && principal\.isActive === false/.test(fn),
        'checked on every authenticated request, not only at login');
    assert.ok(/status\(401\)/.test(fn.slice(fn.indexOf("principal.isActive === false"))),
        '401, matching every other rejection in this function, so the '
        + "frontend's existing interceptor logs the session out instead of "
        + 'just failing every request from here on');
});

console.log('\nThe wallet total is real');

check('the stats endpoint sums every customer\'s wallet, not a page of them', () => {
    const fn = adminController.slice(adminController.indexOf('const getUserStats'));
    assert.ok(/\$lookup/.test(fn) && /from: 'wallets'/.test(fn),
        'joined and summed in the database');
    assert.ok(/totalWalletBalance/.test(fn), 'and returned to the admin panel');
});

check('the panel shows it and refreshes it after a block or unblock', () => {
    assert.ok(/Total Wallet Balance/.test(adminUsersUi), 'the tile exists');
    assert.ok(/API\.get\("\/admin\/users\/stats"\)\.then\(\(res\) => setServerStats/.test(adminUsersUi),
        'toggling a user re-fetches the stats, so Blocked/Active/wallet figures '
        + 'do not sit stale until the page is reloaded');
});

console.log(`\n${passed} user-block checks passed.\n`);
