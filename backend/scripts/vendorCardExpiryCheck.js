/**
 * The 99 Card (mandatory vendor verification card) screen had no way to
 * narrow by registration date or city, no Active/Expired concept at all —
 * every provider counted as permanently valid — and so no "Total Expired"
 * figure to show. There was also nowhere to say how long a card should stay
 * valid; the admin controls that, not a hardcoded rule.
 *
 * These pin: a validity period is an admin-configurable Setting (mirroring
 * the existing vendorCardPrice pattern) rather than a fixed number, both
 * self-registration flows (partner and Sewak) stamp a computed expiry at
 * signup, the 99 Card endpoint's date/city/active/expired scope also drives
 * its own "expired" count and revenue rather than double-counting a
 * different status filter, and the screen actually offers all of it.
 *
 *   node scripts/vendorCardExpiryCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const providerModel = read('models/Provider.js');
const providerController = read('controllers/providerController.js');
const adminController = read('controllers/adminController.js');
const settingsUi = feRead('modules/admin/pages/AdminSettings.jsx');
const cardUi = feRead('modules/admin/pages/Admin99Card.jsx');

console.log('\nA card gets an expiry, and how long it lasts is admin-configured, not hardcoded');

check('the schema carries an expiry per provider', () => {
    assert.ok(/vendorCardExpiry: \{ type: Date, default: null \}/.test(providerModel));
});

check('the validity period is read from a Setting, with a fallback only when unset', () => {
    const fn = sliceFn(providerController, 'const computeVendorCardExpiry');
    assert.ok(/Setting\.findOne\(\{ key: 'vendorCardValidityDays' \}\)/.test(fn));
    assert.ok(/365/.test(fn), 'a sane fallback exists for a fresh install');
});

check('both self-registration flows stamp it at signup', () => {
    assert.ok((providerController.match(/vendorCardExpiry = await computeVendorCardExpiry\(\)/g) || []).length === 2,
        'the partner flow and the Sewak flow both compute one');
    assert.ok((providerController.match(/\n\s*vendorCardExpiry\r?\n\s*\}\);/g) || []).length === 2,
        'and both actually save it on the created Provider');
});

check('the validity period is editable from Platform Settings, next to the card price', () => {
    assert.ok(/vendorCardValidityDays/.test(settingsUi));
    assert.ok(/key: "vendorCardValidityDays", value: platformSettings\.vendorCardValidityDays/.test(settingsUi),
        'saved through the same settings endpoint as everything else here');
});

console.log('\nThe 99 Card screen can filter by when, where, and whether a card is still valid');

check('get99CardData accepts a date range, a city, and an active/expired toggle', () => {
    const fn = sliceFn(adminController, 'const get99CardData');
    assert.ok(/query\.joinedDate = \{\}/.test(fn), 'registration date, not card expiry, is what "date-wise" filters');
    assert.ok(/Provider\.distinct\('city'\)/.test(fn));
    assert.ok(/cardStatus === 'active'/.test(fn) && /cardStatus === 'expired'/.test(fn));
});

check('a card with no recorded expiry is treated as active, not silently expired', () => {
    const fn = sliceFn(adminController, 'const get99CardData');
    assert.ok(/\$or: \[\{ vendorCardExpiry: null \}, \{ vendorCardExpiry: \{ \$gte: now \} \}\]/.test(fn),
        'a provider that predates this field should not read as expired by default');
});

check('the expired count describes the filtered scope, independent of the active/expired tab itself', () => {
    const fn = sliceFn(adminController, 'const get99CardData');
    assert.ok(/Provider\.countDocuments\(\{ \.\.\.query, vendorCardExpiry: \{ \$lt: now \} \}\)/.test(fn),
        'so switching to the Active tab does not make Expired Cards read 0');
});

check('the screen offers the city select, the date range, and the active/expired tabs', () => {
    assert.ok(/value=\{cityFilter\}/.test(cardUi) && /onChange=\{\(e\) => setCityFilter/.test(cardUi));
    assert.ok(/type="date"[\s\S]{0,80}value=\{dateFrom\}/.test(cardUi));
    assert.ok(/setCardStatus\(s\)/.test(cardUi));
    assert.ok(/Expired Cards/.test(cardUi) && /stats\.totalExpired/.test(cardUi));
});

console.log('\nExisting providers can be brought onto the new expiry scheme');

check('a backfill script exists and only touches providers missing an expiry', () => {
    const script = read('scripts/backfillVendorCardExpiry.js');
    assert.ok(/vendorCardExpiry: null/.test(script), 'safe to re-run — already-set providers are left alone');
    assert.ok(/vendorCardValidityDays/.test(script), 'uses the same admin-configured period, not a different hardcoded one');
});

console.log(`\n${passed} vendor-card-expiry checks passed.\n`);
