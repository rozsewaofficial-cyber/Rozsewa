/**
 * Report: the "Choose Your Mode" modal looked broken — "Explore as Local
 * Expert" wrapped to two lines with its icon stranded on the left, while the
 * Sewak button was laid out differently. Both buttons now share one layout
 * (icon tile, title + subtitle, arrow) driven from a single list, with short
 * titles so nothing wraps on a small phone.
 *
 *   node scripts/modeChooserLayoutCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'Index.jsx'), 'utf8');
const block = page.slice(page.indexOf('Service Mode Selection Modal'), page.indexOf('<TopNav />'));

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

check('both modes come from one list rendered by one button layout', () => {
    assert.ok(/mode: 'partner'.*primary: true/.test(block) && /mode: 'sewak'.*primary: false/.test(block));
    assert.strictEqual((block.match(/onClick=\{\(\) => setServiceMode\(mode\)\}/g) || []).length, 1);
});
check('titles are short so they cannot wrap, and the old stacked markup is gone', () => {
    assert.ok(/leading-tight">\{title\}<\/span>/.test(block));
    assert.ok(!/Explore as Local Expert/.test(block));
});
check('the modal markup is balanced (no stray closing tags)', () => {
    const open = (block.match(/<div/g) || []).length - (block.match(/<div[^>]*\/>/g) || []).length, close = (block.match(/<\/div>/g) || []).length;
    assert.strictEqual(open, close);
});
console.log(`\n${passed} mode-chooser-layout checks passed.\n`);
