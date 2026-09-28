/**
 * Customer complaint: the "Just for you" category grid on the home screen
 * was sorted A-Z, ignoring the admin's own display priority — and a
 * category marked "Coming Soon" was greyed out with no label explaining
 * why, so a tapped-and-nothing-happened card looked broken rather than
 * intentionally disabled.
 *
 * getPublicCategories sorted by name — the admin's OWN category list
 * (adminController.js getCategories) already sorts by `index`, the field
 * that exists specifically "for ordering" (Category.js). The public
 * endpoint had simply drifted from that established convention.
 *
 * CategoryGrid.jsx already dimmed/greyscaled a Coming Soon card and
 * blocked its click, but never rendered the words "Coming Soon" anywhere.
 *
 *   node scripts/categoryOrderComingSoonCheck.js
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

const controller = read('controllers/homeController.js');
const adminController = read('controllers/adminController.js');
const grid = feRead('modules/user/components/CategoryGrid.jsx');

console.log('\nThe customer-facing category list is ordered the same way the admin\'s own list is');

check('getPublicCategories sorts by index, matching adminController.getCategories, not alphabetically', () => {
    const fn = sliceFn(controller, 'const getPublicCategories');
    assert.ok(/\.sort\(\{ index: 1 \}\)/.test(fn));
    assert.ok(!/\.sort\(\{ name: 1 \}\)/.test(fn), 'A-Z buried whatever the admin actually wanted shown first');
});

check('this matches the admin\'s own convention, not a newly-invented one', () => {
    assert.ok(/Category\.find\(\)\.sort\(\{ index: 1 \}\)/.test(adminController));
});

console.log('\nA "Coming Soon" category actually says so, not just fades out');

check('the disabled/greyscale card renders a visible "Coming Soon" label', () => {
    const fn = sliceFn(grid, 'const renderCategory');
    assert.ok(/\{cat\.isComingSoon && \(/.test(fn));
    assert.ok(/Coming Soon/.test(fn));
});

check('the card is still click-blocked while showing the label, not just visually dimmed', () => {
    const fn = sliceFn(grid, 'const renderCategory');
    assert.ok(/if \(!cat\.isComingSoon\)/.test(fn));
    assert.ok(/cursor-not-allowed opacity-60 grayscale/.test(fn));
});

console.log(`\n${passed} category-order-coming-soon checks passed.\n`);
