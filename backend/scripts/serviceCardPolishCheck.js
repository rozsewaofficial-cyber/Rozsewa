/**
 * Customer request: "Explore Our Providers" cards looked unpolished. Two
 * concrete gaps, both from props the component already received and simply
 * never used:
 *
 * - `rating`/`reviews` were passed by both ShopListing.jsx and Index.jsx
 *   but never rendered — no marketplace card should omit a star rating.
 * - `verified` was passed but unused; the card had a duplicate arrow
 *   button instead (one hover-only top-right, one persistent bottom-right,
 *   both doing the same thing — the hover one never even shows on touch).
 *
 * Follow-up: the card (h-52, 208px) was still taller than it needed to be
 * on "Explore Our Providers" ("inn ki height thodi kum karo") — trimmed to
 * h-44 (176px). Index.jsx's loading skeleton is kept at the same height so
 * the layout doesn't jump when real cards replace it.
 *
 *   node scripts/serviceCardPolishCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const card = feRead('modules/user/components/ServiceCard.jsx');

console.log('\nServiceCard now surfaces the rating/verified data it was already given');

check('a star rating renders from the rating/reviews props, only when there is a real rating', () => {
    assert.ok(/rating > 0 &&/.test(card), 'a 0/unrated provider should not show a fake "0.0" star');
    assert.ok(/<Star /.test(card));
    assert.ok(/Number\(rating\)\.toFixed\(1\)/.test(card));
});

check('the redundant hover-only arrow is gone, replaced by a verified badge in that spot', () => {
    assert.ok(!/opacity-0 transform translate-y-2 group-hover:opacity-100/.test(card),
        'this was the second arrow that duplicated the always-visible one and never showed on touch devices anyway');
    assert.ok(/\{verified && \(/.test(card));
    assert.ok(/ShieldCheck/.test(card));
});

check('exactly one arrow button remains — the persistent one in the info box', () => {
    const arrowMatches = card.match(/<ArrowUpRight/g) || [];
    assert.strictEqual(arrowMatches.length, 1, 'a second, redundant arrow must not come back');
});

console.log('\nHome page links to the full provider list, matching every other "View all" section');

check('"Explore Our Providers" has a View all link, like Categories and Bazaar do', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    const idx = page.indexOf('Explore Our Providers');
    const block = page.slice(Math.max(0, idx - 200), idx + 300);
    assert.ok(/View all/.test(block));
});

console.log('\nThe card is compact, and its loading skeleton matches so real cards don\'t cause a layout jump');

check('the card height was trimmed down (h-52 -> h-44), not left at the original taller size', () => {
    assert.ok(!/\bh-52\b/.test(card), 'the old, taller card height must not still be present');
    assert.ok(/relative h-44 w-full overflow-hidden rounded-3xl/.test(card));
});

check('the Index.jsx loading skeleton height matches the real card height', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    const idx = page.indexOf('Explore Our Providers');
    const block = page.slice(idx, idx + 1500);
    assert.ok(/min-w-\[240px\] h-44 bg-slate-200/.test(block),
        'a mismatched skeleton height makes the page jump when real cards load in');
});

console.log(`\n${passed} service-card-polish checks passed.\n`);
