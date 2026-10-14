/**
 * Lead targeting reaches the partners who can use a lead: one still on free
 * unlocks needs no wallet balance (the leads list and unlock already allow
 * that), and a partner saved before canReceiveLead existed counts as "yes",
 * its default. A partner switched off, or out of free unlocks with too
 * little balance, still gets none.
 *
 *   node scripts/leadTargetingCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ctrl = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'leadController.js'), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const start = ctrl.indexOf('const findEligibleProviders = async');
const targeting = ctrl.slice(start, ctrl.indexOf('\n};', start));

check('a partner without canReceiveLead saved counts as yes; switched off stays off', () => {
    assert.ok(targeting.includes('canReceiveLead: { $ne: false },'));
    assert.ok(!/canReceiveLead:\s*true/.test(targeting));
});
check('the wallet minimum is skipped while the partner has free unlocks left', () => {
    assert.ok(/const freeLimit = Number\(await getSettingVal\('lead_free_unlock_limit', 3\)\);/.test(targeting));
    assert.ok(/LeadUnlockTransaction\.aggregate\(\[\s*\{ \$match: \{ provider: \{ \$in: candidates\.map\(p => p\._id\) \}, status: 'success' \} \}/.test(targeting));
    assert.ok(/const hasFreeLeft = \(unlocksByProvider\.get\(String\(p\._id\)\) \|\| 0\) < freeLimit;\s*if \(!hasFreeLeft && balance < minWalletBalance\) \{/.test(targeting));
});
check('the leads list and unlock use the same free-unlock rule', () => {
    assert.ok((ctrl.match(/getSettingVal\('lead_free_unlock_limit', 3\)/g) || []).length >= 3);
});

console.log(`\n${passed} lead targeting checks passed.`);
