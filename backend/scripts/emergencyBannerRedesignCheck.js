/**
 * Customer request: the home screen's "24/7 EMERGENCY" banner looked busy
 * and unpolished — a gaudy rainbow-gradient headline, a three-column
 * divided layout (icon | description | badge) that squeezed the
 * description text into an awkward three-line wrap, and no clear call to
 * action beyond the whole card being a link.
 *
 * Redesigned as a cleaner card: icon badge + title + a "LIVE" tag on one
 * row, a short two-line subtitle below it, and an explicit
 * "Book Emergency Help" action row with an arrow, instead of a plain
 * pill of decorative text.
 *
 *   node scripts/emergencyBannerRedesignCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Index.jsx');
const idx = page.indexOf('{/* 24/7 Emergency Banner */}');
const block = page.slice(idx, idx + 1800);

console.log('\nThe emergency card reads as one clean layout, not a squeezed three-column strip');

check('the old rainbow gradient headline and three-column divided layout are gone', () => {
    assert.ok(!/bg-gradient-to-r from-red-500 via-red-300 to-red-500/.test(block),
        'the multi-stop gradient text was the "gaudy" look being asked to fix');
    assert.ok(!/Fix It/.test(block), 'the cramped icon/label/badge column layout is gone');
});

check('the card has a clear icon badge, title, and a short subtitle', () => {
    assert.ok(/24\/7 Emergency Services/.test(block));
    assert.ok(/Siren className="w-7 h-7 text-red-500"/.test(block));
    assert.ok(/LIVE/.test(block));
});

check('it ends with an explicit call-to-action row, not just decorative text', () => {
    assert.ok(/Book Emergency Help/.test(block));
    assert.ok(/<ArrowRight/.test(block), 'a directional cue that this row is tappable');
});

console.log(`\n${passed} emergency-banner-redesign checks passed.\n`);
