/**
 * Customer complaint: "explore [se ek provider ke andar] enter karne ke baad
 * favorite select karne ka option nahi dikh raha hai" — after opening a
 * provider from Explore (ShopListing -> ShopDetail), there was no way to
 * favorite them at all.
 *
 * ServiceCard.jsx (the grid card in Explore) already has a working
 * toggleFavorite (POST/DELETE /auth/favorites, synced from user.favorites)
 * — ShopDetail.jsx, the page you land on after tapping a card, never had
 * one. This wires up the same pattern there.
 *
 *   node scripts/shopDetailFavoriteCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/ShopDetail.jsx');

console.log('\nShopDetail has a working favorite toggle, matching ServiceCard\'s pattern');

check('favorite state is synced from the logged-in user\'s favorites list', () => {
    assert.ok(/const \[isFavorite, setIsFavorite\] = useState\(false\)/.test(page));
    assert.ok(/if \(user\?\.favorites\) \{\s*setIsFavorite\(user\.favorites\.includes\(id\)\);/.test(page));
});

check('toggling calls the same POST/DELETE /auth/favorites endpoints', () => {
    const fn = page.slice(page.indexOf('const toggleFavorite'), page.indexOf('};', page.indexOf('const toggleFavorite')) + 2);
    assert.ok(/await API\.delete\(`\/auth\/favorites\/\$\{id\}`\)/.test(fn));
    assert.ok(/await API\.post\("\/auth\/favorites", \{ providerId: id \}\)/.test(fn));
});

check('a guest is stopped before any API call, not sent an unauthenticated request', () => {
    const fn = page.slice(page.indexOf('const toggleFavorite'), page.indexOf('};', page.indexOf('const toggleFavorite')) + 2);
    assert.ok(/if \(!user\) \{/.test(fn));
    const guardIdx = fn.indexOf('if (!user)');
    const apiCallIdx = fn.search(/API\.(post|delete)/);
    assert.ok(guardIdx !== -1 && apiCallIdx !== -1 && guardIdx < apiCallIdx);
});

check('the heart button is rendered on the page, filled red when favorited', () => {
    assert.ok(/onClick=\{toggleFavorite\}/.test(page));
    assert.ok(/fill-rose-500 text-rose-500/.test(page));
});

console.log(`\n${passed} shop-detail-favorite checks passed.\n`);
