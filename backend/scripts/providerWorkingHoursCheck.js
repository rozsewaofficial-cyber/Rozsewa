/**
 * Customer report: "agar koi partner 9 to 12 available hai to 1 baje uska
 * profile show na kare" — a provider who set their working hours to 9-12
 * still showed up in listings at 1pm, 6pm, any hour, as long as their
 * manual isOnline toggle happened to be on. isOnline and a configured
 * schedule were two entirely separate things; nothing ever compared the
 * clock against Provider.availability.
 *
 * Reproduced live: setting a real provider's availability to 09:00-12:00
 * for every day and querying /public/providers at 14:36 IST returned one
 * fewer provider than before; widening the window to include the current
 * time, or setting is24x7, brought them back. A provider who has never
 * opened the Availability screen (empty array) must still show — this pins
 * that too.
 *
 * Follow-up: the customer kept reporting this same issue even after it was
 * fixed, because the complaint literally said "uska profile show na kare" —
 * the listing endpoints hide an out-of-hours provider, but their direct
 * profile page (ShopDetail.jsx, reached via a shared link or Favorites)
 * never applied the check at all. Fixed by having getPublicProviderById
 * report isWithinWorkingHours, and ShopDetail.jsx shows a "Currently
 * Closed" badge and disables checkout when it's false — the profile still
 * loads (info/reviews stay visible), only booking is blocked.
 *
 *   node scripts/providerWorkingHoursCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const controller = read('controllers/homeController.js');

const sliceFn = (src, startMarker, endMarker) => {
    const start = src.indexOf(startMarker);
    const end = src.indexOf(endMarker, start);
    return src.slice(start, end === -1 ? undefined : end);
};

console.log('\nWorking hours are checked against the clock, in IST regardless of server timezone');

check('the clock is read in Asia/Kolkata, not the server\'s own timezone', () => {
    const fn = sliceFn(controller, 'const getIstDayAndTime', 'const isProviderWithinWorkingHours');
    assert.ok(/timeZone: 'Asia\/Kolkata'/.test(fn),
        'provider hours are entered in IST via ProviderAvailability.jsx — a server running in UTC must not compare against its own local hour');
});

check('24/7 (is24x7 or isEmergencyEnabled) always wins, and a provider who never set hours is never hidden', () => {
    const fn = sliceFn(controller, 'const isProviderWithinWorkingHours', '// @desc    Get all active zones');
    assert.ok(/if \(provider\.is24x7 \|\| provider\.isEmergencyEnabled\) return true;/.test(fn),
        'the Settings tile / dashboard Emergency button store 24/7 as isEmergencyEnabled — that partner must not show Closed at night');
    assert.ok(/if \(!provider\.availability \|\| provider\.availability\.length === 0\) return true;/.test(fn),
        'an empty array means the provider never touched the Availability screen — must default to showing, not hiding everyone');
});

check('a day the provider marked inactive hides them; a day with no entry fails open', () => {
    const fn = sliceFn(controller, 'const isProviderWithinWorkingHours', '// @desc    Get all active zones');
    assert.ok(/if \(!todayEntry\) return true;/.test(fn));
    assert.ok(/if \(todayEntry\.isActive === false\) return false;/.test(fn));
    assert.ok(/return time >= todayEntry\.startTime && time <= todayEntry\.endTime;/.test(fn));
});

console.log('\nBoth customer-facing listing endpoints actually use it');

check('getFeaturedProviders filters by it and over-fetches first so the 8-item cap still fills up', () => {
    const fn = sliceFn(controller, 'const getFeaturedProviders', 'const getPublicProviders');
    assert.ok(/\.limit\(40\)/.test(fn), 'fetch more than 8 before filtering, or an all-restricted batch returns too few');
    assert.ok(/\.filter\(isProviderWithinWorkingHours\)/.test(fn));
    assert.ok(/\.slice\(0, 8\)/.test(fn));
    assert.ok(/availability is24x7/.test(fn), 'the fields the filter needs must actually be selected');
});

check('getPublicProviders skips an out-of-hours provider in its enrichment loop', () => {
    const fn = sliceFn(controller, 'const getPublicProviders', 'module.exports');
    assert.ok(/if \(!isProviderWithinWorkingHours\(p\)\) \{/.test(fn));
    const providerSelectLine = fn.split('\n').find(l => l.includes('.select(') && l.includes('isEmergencyEnabled'));
    assert.ok(providerSelectLine && /availability'\)/.test(providerSelectLine),
        'the main Provider .select() projection must include availability, or the filter always sees it as empty');
});

console.log('\nThe direct profile page (not just listings) reflects working hours too');

check('getPublicProviderById reports isWithinWorkingHours on the response', () => {
    const fn = sliceFn(controller, 'const getPublicProviderById', 'const getFeaturedProviders');
    assert.ok(/providerData\.isWithinWorkingHours = isProviderWithinWorkingHours\(provider\)/.test(fn));
    const selectLine = fn.split('\n').find(l => l.includes('.select(') && l.includes('openingTime'));
    assert.ok(selectLine && /availability is24x7/.test(selectLine),
        'without availability/is24x7 in the projection, isProviderWithinWorkingHours always sees an empty/missing provider');
});

check('ShopDetail.jsx shows a Currently Closed badge and disables checkout, without hiding the rest of the profile', () => {
    const page = feRead('modules/user/pages/ShopDetail.jsx');
    assert.ok(/isWithinWorkingHours: found\.isWithinWorkingHours !== undefined \? found\.isWithinWorkingHours : true/.test(page));
    assert.ok(/Currently Closed/.test(page));
    assert.ok(/disabled=\{!provider\.isOnline \|\| !provider\.isWithinWorkingHours\}/.test(page),
        'checkout must be blocked when outside hours, the same as when the provider is offline');
});

console.log(`\n${passed} provider-working-hours checks passed.\n`);
