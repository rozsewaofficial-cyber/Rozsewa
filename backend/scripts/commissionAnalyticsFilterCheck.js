/**
 * Commission Analytics had Category, a single Provider, and Subscription
 * Plan filters — no way to slice by city or by Partner-vs-Sewak, both
 * dimensions the admin note asked for directly.
 *
 * A Booking carries neither — both come from the Provider it belongs to.
 * A single specific Provider already pins one city and one type exactly,
 * so it takes priority over the two broader filters rather than being
 * ANDed against a provider it can't possibly disagree with.
 *
 *   node scripts/commissionAnalyticsFilterCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker, endMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const end = endMarker ? src.indexOf(endMarker, start + startMarker.length) : -1;
    return end === -1 ? src.slice(start, start + 6000) : src.slice(start, end);
};

const controller = read('controllers/v2CommissionController.js');
const ui = feRead('modules/admin/pages/AdminCommissionAnalytics.jsx');

console.log('\nCity and Partner/Sewak resolve through Provider, and a specific provider overrides both');

check('a single providerId still wins outright, as before', () => {
    const fn = sliceFn(controller, 'exports.getCommissionAnalytics', 'exports.getCommissionPreview');
    assert.ok(/if \(providerId\) \{\s*\n\s*matchQuery\.providerId = new mongoose\.Types\.ObjectId\(providerId\);/.test(fn));
});

check('without one, city and providerCategory resolve to a set of matching providers', () => {
    const fn = sliceFn(controller, 'exports.getCommissionAnalytics', 'exports.getCommissionPreview');
    assert.ok(/else if \(city \|\| providerCategory\)/.test(fn));
    assert.ok(/providerFilter\.providerCategory = 'sewak'/.test(fn) && /providerFilter\.providerCategory = \{ \$ne: 'sewak' \}/.test(fn));
    assert.ok(/matchQuery\.providerId = \{ \$in: matchingProviders\.map\(p => p\._id\) \};/.test(fn));
});

check('subscription-revenue (the ledger query) shares the same resolved provider scope', () => {
    const fn = sliceFn(controller, 'Query subscription payments from Ledger', 'A sum, so it is summed');
    assert.ok(/if \(matchQuery\.providerId\)/.test(fn),
        'otherwise GMV/commission could narrow to a city while subscription revenue stayed platform-wide');
});

console.log('\nThe admin screen offers both filters and keeps them mutually consistent with the provider picker');

check('a City select and a Partner/Sewak select exist, wired to state', () => {
    assert.ok(/value=\{selectedCity\}/.test(ui) && /value=\{selectedProviderCategory\}/.test(ui));
    assert.ok(/<option value="partner">Partner<\/option>/.test(ui) && /<option value="sewak">Sewak<\/option>/.test(ui));
});

check('both are disabled once a specific provider is chosen', () => {
    const cityBlock = sliceFn(ui, 'City</label>', '</div>');
    const typeBlock = sliceFn(ui, 'Partner / Sewak</label>', '</div>');
    assert.ok(/disabled=\{!!selectedProvider\}/.test(cityBlock));
    assert.ok(/disabled=\{!!selectedProvider\}/.test(typeBlock));
});

check('picking a provider clears whichever of the two was set, not just ignores them visually', () => {
    const fn = sliceFn(ui, 'value={selectedProvider}', 'Provider</option>');
    assert.ok(/setSelectedCity\(''\); setSelectedProviderCategory\(''\)/.test(fn));
});

check('both filters are actually sent to the analytics request', () => {
    const fn = sliceFn(ui, 'const fetchAnalytics', 'const handleApplyFilters');
    assert.ok(/params\.city = selectedCity/.test(fn) && /params\.providerCategory = selectedProviderCategory/.test(fn));
});

console.log(`\n${passed} commission-analytics-filter checks passed.\n`);
