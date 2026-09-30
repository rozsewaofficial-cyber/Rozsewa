/**
 * Customer request: "banner k curve bilkul minimum karo" — the home banner
 * carousel's rounded corners (20px on mobile, 24px on larger screens) were
 * too pronounced. Reduced to a near-sharp 4px on every breakpoint.
 *
 *   node scripts/bannerCornerRadiusCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const carousel = feRead('modules/user/components/PromoBannerCarousel.jsx');

console.log('\nThe banner carousel has near-sharp corners, not the old pronounced curve');

check('the old, more rounded corner sizes are gone', () => {
    assert.ok(!/rounded-\[20px\]/.test(carousel), 'the old mobile corner radius must not still be present');
    assert.ok(!/rounded-\[24px\]/.test(carousel), 'the old larger-screen corner radius must not still be present');
});

check('the outer frame uses a minimal 4px radius on every breakpoint', () => {
    assert.ok(/rounded-\[4px\]/.test(carousel));
});

console.log(`\n${passed} banner-corner-radius checks passed.\n`);
