/**
 * Customer request: "isse thoda sa left me karo" — on the mobile TopNav, the
 * "Indore" location pill (between the logo and the bell/theme/profile icon
 * group) sat too far right for their liking. Nudged left with a small
 * negative left margin rather than restructuring the flex layout.
 *
 *   node scripts/mobileNavLocationPillPositionCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const topNav = feRead('modules/user/components/TopNav.jsx');

console.log('\nThe mobile nav\'s location pill sits nudged toward the logo');

check('the mobile navbar location button carries a negative left margin', () => {
    const mobileIdx = topNav.indexOf('Mobile Navbar');
    const btnIdx = topNav.indexOf('setShowLocationModal(true)', mobileIdx);
    const block = topNav.slice(btnIdx, btnIdx + 400);
    assert.ok(/-ml-3/.test(block), 'a small negative left margin should pull it toward the logo');
});

check('the desktop navbar location button is untouched — only the mobile one moved', () => {
    const mobileIdx = topNav.indexOf('Mobile Navbar');
    const desktopBlock = topNav.slice(0, mobileIdx);
    const btnIdx = desktopBlock.indexOf('setShowLocationModal(true)');
    const block = desktopBlock.slice(btnIdx, btnIdx + 400);
    assert.ok(!/-ml-3/.test(block), 'the desktop layout already has its own spacing and was not asked to change');
});

console.log(`\n${passed} mobile-nav-location-pill-position checks passed.\n`);
