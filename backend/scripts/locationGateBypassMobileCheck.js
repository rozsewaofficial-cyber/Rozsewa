/**
 * The "Set Your Location" prompt (LocationGate) is skipped for specific customer
 * mobile numbers only; everyone else, and logged-out visitors, still get it.
 *
 *   node scripts/locationGateBypassMobileCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'LocationGate.jsx'), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('there is an explicit allowlist of mobile numbers', () => {
    assert.ok(/const LOCATION_GATE_BYPASS_MOBILES = \["6268455485"\]/.test(src));
});
check('the gate reads the signed-in user and checks the allowlist', () => {
    assert.ok(/const \{ user, userLocation, detectLocation, setUserCity \} = useAuth\(\)/.test(src));
    assert.ok(/LOCATION_GATE_BYPASS_MOBILES\.includes\(user\?\.mobile\)/.test(src));
});
check('only an allowlisted user skips the prompt; the global bypass stays off', () => {
    assert.ok(/if \(BYPASS_LOCATION_GATE \|\| skipsGate \|\| status === "success"\)/.test(src));
    assert.ok(/const BYPASS_LOCATION_GATE = false;/.test(src));
});

console.log(`\n${passed} location-gate bypass checks passed.\n`);
