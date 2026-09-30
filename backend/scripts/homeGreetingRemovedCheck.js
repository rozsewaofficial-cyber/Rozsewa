/**
 * Customer request: "isse remove karo upr se and search ko upr karo" — the
 * "Hi, {name} / You are welcome to RozSewa" greeting at the top of the home
 * header took up space above the search bar for no real benefit; removed it
 * so the search bar sits higher, right under the notification bell.
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

console.log('\nThe home header greeting is gone, and nothing was left dangling behind it');

check('the greeting text and its now-unused userName derivation are both gone', () => {
    assert.ok(!/You are welcome to RozSewa/.test(page));
    assert.ok(!/Hi, <span/.test(page));
    assert.ok(!/const userName = /.test(page), 'userName was only ever used by the removed greeting');
});

check('the notification bell button still renders, now alone in its row', () => {
    assert.ok(/onClick=\{\(\) => navigate\('\/notifications'\)\}/.test(page));
    assert.ok(/<Bell className="w-\[22px\] h-\[22px\]"/.test(page));
});

check('the search bar sits directly below the bell, not pushed down by the old greeting block', () => {
    const idx = page.indexOf("navigate('/notifications')");
    const block = page.slice(idx, idx + 800);
    assert.ok(/<SearchBar/.test(block));
});

console.log(`\n${passed} home-greeting-removed checks passed.\n`);
