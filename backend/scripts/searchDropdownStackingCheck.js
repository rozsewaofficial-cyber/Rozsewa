/**
 * Customer complaint: a ServiceCard's favorite heart icon showed through on
 * top of the search suggestion dropdown, mid-row.
 *
 * The dropdown itself is z-[60], nested inside the page's gradient header
 * div. That header div only had z-10 (ShopListing) or no z-index at all
 * (Index). The results/category grid below sits in a plain <main> with
 * position:static — so a positioned descendant inside it (the heart icon,
 * z-10; a "Coming Soon" badge, z-20) is compared directly against the
 * header's own z-index at the outer stacking context, not against the
 * dropdown's z-60 (which is scoped inside the header's local context and
 * never gets compared at that outer level at all). Tied or higher, and
 * later in the DOM than the header, the card content painted on top.
 *
 *   node scripts/searchDropdownStackingCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

console.log('\nThe header that hosts the search dropdown outranks any card content below it');

check('ShopListing\'s header carries a z-index above the highest z-index used inside a ServiceCard', () => {
    const page = feRead('modules/user/pages/ShopListing.jsx');
    const headerLine = page.split('\n').find(l => l.includes('rounded-b-[2rem] shadow-sm mb-2'));
    assert.ok(headerLine, 'the header div is still where this pins it');
    const headerZ = Number((headerLine.match(/\bz-(\d+)\b/) || [])[1]);
    assert.ok(Number.isFinite(headerZ), 'the header declares an explicit z-index');

    const card = feRead('modules/user/components/ServiceCard.jsx');
    const cardZs = [...card.matchAll(/\bz-(\d+)\b/g)].map(m => Number(m[1]));
    const maxCardZ = Math.max(...cardZs);

    assert.ok(headerZ > maxCardZ,
        `header z-${headerZ} must beat every z-index inside a card (highest: z-${maxCardZ}) — <main> below is ` +
        `position:static, so its positioned descendants are compared directly against the header's own ` +
        `z-index, not against the dropdown's z-60 nested inside it`);
});

check('the home page header carries the same explicit, high z-index', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    const headerLine = page.split('\n').find(l => l.includes('New Gradient Header Section') === false && l.includes('rounded-b-[2rem] shadow-sm"'));
    assert.ok(headerLine, 'the header div is still where this pins it');
    assert.ok(/\bz-30\b/.test(headerLine), 'no z-index at all here made it lose to any positioned card content, not just tie');
});

console.log(`\n${passed} search-dropdown-stacking checks passed.\n`);
