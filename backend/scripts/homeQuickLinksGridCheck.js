/**
 * Customer request: Bazaar / Insta Work / Refer & Earn / Sell Scrap were
 * four separate full-width cards stacked one after another (four scrolls of
 * near-identical banners). Wanted as a 2x2 grid — 2 in one row, the other 2
 * in the row below.
 *
 *   node scripts/homeQuickLinksGridCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Index.jsx');

console.log('\nThe four promo cards are one 2-column grid, not four stacked full-width sections');

check('quickLinksGrid uses a 2-column grid, defined once', () => {
    const idx = page.indexOf('const quickLinksGrid = (');
    assert.ok(idx !== -1);
    const block = page.slice(idx, idx + 4000);
    assert.ok(/className="grid grid-cols-2 gap-3/.test(block), 'grid-cols-2 is what actually produces the 2-per-row layout');
    for (const label of ['RozSewa Bazaar', 'Insta Work', 'Refer & Earn', 'Sell Scrap']) {
        assert.ok(block.includes(label), `${label} must still be one of the four tiles`);
    }
});

check('it replaces the old four separate full-width sections, in both mode branches', () => {
    const matches = page.match(/\{quickLinksGrid\}/g) || [];
    assert.strictEqual(matches.length, 2, 'one per mode branch (Local Expert and Sewak)');
    assert.ok(!/Bazaar Promo Section/.test(page), 'the old standalone Bazaar section is gone, not just visually replaced');
    assert.ok(!page.includes('Got scrap to sell?'), 'the old standalone Sell Scrap CTA copy is gone too');
});

check('Insta Work drops out of the grid (not an empty slot) when disabled for the city', () => {
    const idx = page.indexOf('const quickLinksGrid = (');
    const block = page.slice(idx, idx + 4000);
    assert.ok(/\{instaEnabled && \(/.test(block),
        'conditionally rendered inside the grid, same instaEnabled flag as before');
});

console.log(`\n${passed} home-quick-links-grid checks passed.\n`);
