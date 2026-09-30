/**
 * Customer request: Bazaar / Insta Work / Refer & Earn / Sell Scrap were
 * four separate full-width cards stacked one after another (four scrolls of
 * near-identical banners). Wanted as a 2x2 grid — 2 in one row, the other 2
 * in the row below.
 *
 * Follow-up: the first grid pass used a tall vertical tile (icon on top,
 * title below) with `truncate`, which clipped every title at real mobile
 * widths ("RozSew...", "Refer & E..."). Redesigned as a compact horizontal
 * tile (icon left, text right, no truncate, smaller type) so the full label
 * always shows.
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

check('tile titles are never clipped with an ellipsis at real card widths', () => {
    const idx = page.indexOf('const quickLinksGrid = (');
    const block = page.slice(idx, idx + 4000);
    assert.ok(!/text-\[13px\] leading-tight truncate/.test(block),
        'this was the exact class combination that clipped "RozSewa Bazaar" down to "RozSew..."');
    const titleMatches = block.match(/<h3 className="font-black[^"]*">/g) || [];
    assert.ok(titleMatches.length >= 4, 'all four tile titles should be present');
    for (const cls of titleMatches) {
        assert.ok(!cls.includes('truncate'), `a tile title must not clip: ${cls}`);
    }
});

check('the icon aligns to the top of the text block, consistently, whether the title wraps to one or two lines', () => {
    // items-center vertically centered the icon against the *whole* row
    // height — fine for a single-line title, but for a two-line title
    // ("RozSewa Bazaar", "Refer & Earn" at real widths) it left the icon
    // sitting noticeably higher than it did on the one-line tiles right
    // next to it, an inconsistency visible at a glance across the grid.
    const idx = page.indexOf('const quickLinksGrid = (');
    const block = page.slice(idx, idx + 4000);
    const rowMatches = block.match(/className="flex items-(start|center) gap-2\.5[^"]*"/g) || [];
    assert.strictEqual(rowMatches.length, 4, 'all four tile rows should be present');
    for (const cls of rowMatches) {
        assert.ok(cls.includes('items-start'), `every tile row must use items-start, not items-center: ${cls}`);
    }
});

console.log(`\n${passed} home-quick-links-grid checks passed.\n`);
