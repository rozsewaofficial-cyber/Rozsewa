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

console.log(`\n${passed} service-card-polish checks passed.\n`);
