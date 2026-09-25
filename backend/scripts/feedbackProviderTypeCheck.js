/**
 * Feedback note (item 43): Partner-wise and Sewak-wise filter. Feedback is
 * not a standalone model — it's Booking.rating/comment surfaced through
 * getFeedbackData, which populates the reviewed Provider but never carried
 * providerCategory through to the response, so there was no way to tell a
 * Partner's feedback from a Sewak's.
 *
 * These pin: the Provider population selects providerCategory; the mapped
 * response classifies it the same way the Provider model itself defaults
 * (partner unless explicitly sewak); and the admin screen's new dropdown
 * actually narrows the already-client-side-filtered list by it, alongside
 * the existing rating/source filters and the Clear Filters button.
 *
 *   node scripts/feedbackProviderTypeCheck.js
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

const controller = read('controllers/adminController.js');
const ui = feRead('modules/admin/pages/AdminFeedback.jsx');

console.log('\ngetFeedbackData carries the reviewed provider\'s category through to the response');

check('the Provider population selects providerCategory, not just shopName', () => {
    const fn = sliceFn(controller, 'const getFeedbackData');
    assert.ok(/\.populate\('providerId', 'shopName providerCategory'\)/.test(fn));
});

check('a review is classified partner unless the provider is explicitly sewak, matching the Provider model default', () => {
    const fn = sliceFn(controller, 'const getFeedbackData');
    assert.ok(/providerCategory: r\.providerId\?\.providerCategory === 'sewak' \? 'sewak' : 'partner'/.test(fn));
});

console.log('\nThe admin screen offers a Partner-wise / Sewak-wise filter alongside the existing ones');

check('a provider-type select exists and drives state', () => {
    assert.ok(/const \[providerTypeFilter, setProviderTypeFilter\] = useState\("all"\)/.test(ui));
    assert.ok(/value=\{providerTypeFilter\} onChange=\{\(e\) => setProviderTypeFilter/.test(ui));
    assert.ok(/<option value="partner">Partner-wise<\/option>/.test(ui) && /<option value="sewak">Sewak-wise<\/option>/.test(ui));
});

check('it actually narrows the filtered list, alongside rating/source/search', () => {
    const fn = sliceFn(ui, 'const filteredReviews');
    assert.ok(/const matchesProviderType = providerTypeFilter === "all" \|\| r\.providerCategory === providerTypeFilter/.test(fn));
    assert.ok(/matchesSearch && matchesFilter && matchesRole && matchesProviderType/.test(fn));
});

check('Clear Filters resets it too, and the button appears when it is set', () => {
    assert.ok(/providerTypeFilter !== "all"/.test(ui));
    assert.ok(/setProviderTypeFilter\("all"\);/.test(ui));
});

console.log(`\n${passed} feedback-provider-type checks passed.\n`);
