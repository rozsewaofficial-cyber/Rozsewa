/**
 * Customer complaint: "RozSewa Coins ke andar Refer and Earn hai wo dikh
 * nahi rha hai" — the /refer-earn page always existed and worked, but the
 * only entry point to it was a small "Earn more" pill tucked into the
 * RozSewa Coins page's own header (RozSewaCoins.jsx) — nothing pointed to
 * it from the home screen, so it was effectively undiscoverable for anyone
 * who hadn't already found Coins first.
 *
 *   node scripts/homeReferEarnCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Index.jsx');

console.log('\nHome screen now has its own Refer & Earn entry point, not just RozSewa Coins');

check('a referEarnSection linking to /refer-earn is defined once', () => {
    assert.ok(/const referEarnSection = \(/.test(page));
    assert.ok(/to="\/refer-earn"/.test(page));
});

check('it renders in both the Local Expert and Sewak branches, alongside instaWorkSection', () => {
    const matches = page.match(/\{referEarnSection\}/g) || [];
    assert.strictEqual(matches.length, 2, 'one per mode branch, same as instaWorkSection');
});

console.log(`\n${passed} home-refer-earn checks passed.\n`);
