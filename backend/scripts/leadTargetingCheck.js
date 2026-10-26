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
check('the wallet minimum is skipped while the partner has free services left', () => {
    assert.ok(/const hasFreeLeft = freeLeftOf\(p\) > 0;\s*if \(!hasFreeLeft && balance < minWalletBalance\) \{/.test(targeting));
});
check('the leads list and unlock use the one free allowance shared with bookings and Insta Work', () => {
    assert.ok(/const freeLeftOf = \(p\) =>/.test(ctrl) && /freeTrial\?\.usedServices/.test(ctrl));
    assert.ok(/const hasFreeLeft = freeLeftOf\(provider\) > 0;/.test(ctrl));          // the leads list
    assert.ok(/const hasFreeLeft = freeLeftOf\(trialProvider\) > 0;/.test(ctrl));      // unlock
    assert.ok(/'freeTrial\.usedServices': 1/.test(ctrl));                               // unlock uses one
    assert.ok(!/lead_free_unlock_limit/.test(ctrl));                                    // no separate lead allowance
});
check('a lead goes to partners within 10 km by default', () => {
    assert.ok(/getSettingVal\('lead_geofence_radius', 10\)/.test(targeting));
});

console.log(`\n${passed} lead targeting checks passed.`);
