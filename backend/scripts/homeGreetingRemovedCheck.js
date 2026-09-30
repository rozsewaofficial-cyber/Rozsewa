/**
 * Customer request: "isse remove karo upr se and search ko upr karo" — the
 * "Hi, {name} / You are welcome to RozSewa" greeting at the top of the home
 * header took up space above the search bar for no real benefit; removed it
 * so the search bar sits higher.
 *
 * Follow-up ("notification ko upr header me le jao"): the notification bell
 * that took the greeting's place in its own row was itself moved up again —
 * into TopNav's mobile bar, alongside location/theme/profile, matching where
 * the desktop navbar already puts it. Nothing renders it in Index.jsx's own
 * header any more.
 *
 *   node scripts/homeGreetingRemovedCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Index.jsx');
const topNav = feRead('modules/user/components/TopNav.jsx');

console.log('\nThe home header greeting is gone, and nothing was left dangling behind it');

check('the greeting text and its now-unused userName derivation are both gone', () => {
    assert.ok(!/You are welcome to RozSewa/.test(page));
    assert.ok(!/Hi, <span/.test(page));
    assert.ok(!/const userName = /.test(page), 'userName was only ever used by the removed greeting');
});

check('Index.jsx no longer renders its own notification bell', () => {
    assert.ok(!/navigate\('\/notifications'\)/.test(page),
        'the bell moved into TopNav; a leftover copy here would show it twice');
    assert.ok(!/Bell/.test(page), 'the now-unused Bell icon import should be gone too, not just the button');
});

check('the search bar is the first thing in the gradient header now', () => {
    const idx = page.indexOf('bg-gradient-to-b from-[#e0f2fe]');
    const block = page.slice(idx, idx + 500);
    assert.ok(/<SearchBar/.test(block));
});

console.log("\nThe notification bell lives in TopNav's mobile bar instead");

check("the mobile navbar's icon row has a bell, matching the desktop navbar", () => {
    const mobileIdx = topNav.indexOf('Mobile Navbar');
    const mobileBlock = topNav.slice(mobileIdx);
    assert.ok(/to="\/notifications"/.test(mobileBlock), 'a Link to notifications in the mobile bar');
    assert.ok(/unreadCount > 0/.test(mobileBlock.slice(mobileBlock.indexOf('to="/notifications"'), mobileBlock.indexOf('to="/notifications"') + 400)),
        'the unread badge should show here too, same as desktop');
});

console.log(`\n${passed} home-greeting-removed checks passed.\n`);
