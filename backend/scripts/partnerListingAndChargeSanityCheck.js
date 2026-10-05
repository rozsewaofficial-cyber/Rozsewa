/**
 * Regression check for four partner-side bugs found in end-to-end testing:
 *  1. GET /public/providers ignored `emergency=true`, so non-emergency providers showed.
 *  2. The Settings "24/7 SERVICE" tile (isEmergencyEnabled) never affected the
 *     customer "24/7" filter, which only read is24x7.
 *  3. A provider pinned on another continent produced a ~₹43,000 travel charge.
 *  4. The Timing screen accepted a day with closing time before opening time.
 *
 *   node scripts/partnerListingAndChargeSanityCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const be = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const fe = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const home = be('controllers/homeController.js');
const fn = home.slice(home.indexOf('const getPublicProviders'), home.indexOf('const getPublicProviders') + 2500);

console.log('\nListing filters');
check('emergency=true is read and filters on is24x7 OR isEmergencyEnabled', () => {
    assert.ok(/storeVisitOnly, emergency[\w, ]*\} = req\.query/.test(fn));
    assert.ok(/emergency === 'true'[\s\S]{0,80}andClauses\.push\(\{ \$or: \[\{ is24x7: true \}, \{ isEmergencyEnabled: true \}\] \}\)/.test(fn));
});
check('the 24/7 filter matches is24x7 OR isEmergencyEnabled, without clobbering search $or', () => {
    assert.ok(/\$or: \[\{ is24x7: true \}, \{ isEmergencyEnabled: true \}\]/.test(fn));
    assert.ok(/query\.\$and = andClauses/.test(fn));
    assert.ok(!/query\.is24x7 = true/.test(fn));
});
check('shop detail treats isEmergencyEnabled as 24/7 and the API exposes it', () => {
    assert.ok(/availability is24x7 isEmergencyEnabled isHomeVisitAvailable[\w ]*'\)/.test(home));
    assert.ok(/found\.is24x7 \|\| found\.isEmergencyEnabled/.test(fe('modules/user/pages/ShopDetail.jsx')));
});

console.log('\nTravel charge');
const svc = be('services/DistanceChargeService.js');
check('an implausible distance falls back instead of being billed', () => {
    assert.ok(/MAX_PLAUSIBLE_DISTANCE_KM = 200/.test(svc));
    assert.ok(/distanceKm > MAX_PLAUSIBLE_DISTANCE_KM\) \{\s*distanceKm = null;/.test(svc));
});

console.log('\nAvailability validation');
check('closing time must be after opening time for active days', () => {
    const pc = be('controllers/providerController.js');
    assert.ok(/a\.endTime <= a\.startTime/.test(pc));
    assert.ok(/must be after opening time/.test(pc));
});

console.log(`\n${passed} partner-listing/charge checks passed.\n`);
