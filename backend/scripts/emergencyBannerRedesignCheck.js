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
 * Follow-up: the card still took up too much vertical space on the home
 * feed ("iss ki height kum karo") — trimmed the outer padding, icon badge,
 * and text sizes down a notch (p-5->p-4, h-14/w-7 icon->h-11/w-5, etc).
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
    assert.ok(/<Siren className="w-\d+ h-\d+ text-red-500"/.test(block));
    assert.ok(/LIVE/.test(block));
});

check('it ends with an explicit call-to-action row, not just decorative text', () => {
    assert.ok(/Book Emergency Help/.test(block));
    assert.ok(/<ArrowRight/.test(block), 'a directional cue that this row is tappable');
});

console.log('\nThe card stays compact — a home feed with several sections shouldn\'t give one of them an oversized slot');

check('the outer card padding and icon badge were trimmed down, not left at the original larger size', () => {
    assert.ok(/rounded-\[24px\][^"]*\bp-4\b/.test(block),
        'the card padding (was p-5) should be tighter');
    assert.ok(/h-11 w-11 rounded-2xl bg-red-500\/10/.test(block),
        'the icon badge (was h-14 w-14) should be smaller');
});

console.log(`\n${passed} emergency-banner-redesign checks passed.\n`);
