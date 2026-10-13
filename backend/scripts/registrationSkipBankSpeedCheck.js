/**
 * Finishing registration (Bank Details "Skip for now" or Submit) replies at
 * once: the server does not wait on admin pushes, and signup does not wait on
 * the notification permission prompt or send the device token twice.
 *
 *   node scripts/registrationSkipBankSpeedCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const ctrl = read('backend', 'controllers', 'providerController.js');
const auth = read('frontend', 'src', 'context', 'AuthContext.jsx');

const handler = (name) => {
    const start = ctrl.indexOf(`const ${name} = async`);
    assert.ok(start >= 0, `${name} not found`);
    return ctrl.slice(start, ctrl.indexOf('\n};', start));
};

for (const name of ['registerProvider', 'registerSewak']) {
    check(`${name}: admin KYC pushes run in the background, after the reply is not held`, () => {
        const body = handler(name);
        assert.ok(/\(async \(\) => \{ try \{[\s\S]*?adminRecipients\(\)[\s\S]*?\} \}\)\(\);/.test(body));
        assert.ok(!/^\s{8}try \{\s*\n\s*const User = require\('\.\.\/models\/User'\);\s*\n\s*const \{ sendNotificationToUser \}/m.test(body), 'pushes are not awaited inline');
    });
}
check('signup does not wait on the notification token (synced once auth is set)', () => {
    const start = auth.indexOf('const signup = async');
    const body = auth.slice(start, auth.indexOf('const logout', start));
    assert.ok(!/requestForToken/.test(body));
    assert.ok(/setTimeout\(syncFCMToken, 2000\)/.test(auth));
});

console.log(`\n${passed} registration speed checks passed.`);
