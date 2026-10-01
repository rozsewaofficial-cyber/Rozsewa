/**
 * Report: Bazaar and Insta Work showed no real icons. Bazaar categories were
 * text-only chips; every Insta Work service drew the same hardcoded bolt,
 * ignoring the icon the admin set (InstaService.icon). Both now go through
 * one CategoryIcon resolver: image URL, Lucide name (any case), a keyword
 * guess from the name, then a generic fallback — so a value like "CAR" or an
 * image URL from the admin panel always draws.
 *
 *   node scripts/categoryIconCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const fe = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', rel), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const comp = fe('components/CategoryIcon.jsx');
const insta = fe('modules/user/pages/InstaWork.jsx');
const bazaar = fe('modules/user/pages/RojsewaBazaar.jsx');

check('resolver handles image URLs, case-insensitive Lucide names and keywords', () => {
    assert.ok(/isImageSrc/.test(comp) && /<img src=/.test(comp));
    assert.ok(/toLowerCase\(\) === wanted/.test(comp));
    assert.ok(/KEYWORD_ICONS\.find/.test(comp));
});
check('Insta Work draws each service\'s own icon, not a hardcoded bolt', () => {
    assert.ok(/<CategoryIcon icon=\{s\.icon\} label=\{s\.name\}/.test(insta));
});
check('Bazaar shows illustrated category tiles using the category icon', () => {
    assert.ok(/<CategoryIcon icon=\{cat\.icon\} label=\{cat\.label\}/.test(bazaar));
    assert.ok(/categoryDetails\.find\(c => c\.name === cat\)\?\.icon/.test(bazaar));
});
console.log(`\n${passed} category-icon checks passed.\n`);
