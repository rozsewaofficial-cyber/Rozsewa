/**
 * Customer request: "iss part ka bhi UI sahi karo" (on the "Why RozSewa?"
 * section) -> clarified as wanting the three stacked cards (Verified Pros /
 * Fixed Pricing / On-Time Service) made more compact, not restyled or
 * regridded. Trimmed card padding (p-4->p-3), icon badge (p-3.5->p-2.5,
 * icon w-6/h-6->w-5/h-5), text sizes, and the surrounding section spacing.
 *
 *   node scripts/whyRozSewaCompactCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Index.jsx');
const idx = page.indexOf('Why RozSewa?');
const block = page.slice(Math.max(0, idx - 200), idx + 1500);

console.log('\nThe "Why RozSewa?" cards are compact, not the original larger size');

check('the card padding and gap were trimmed down', () => {
    assert.ok(!/gap-4 p-4 rounded-3xl/.test(block), 'the old, larger card padding must not still be present');
    assert.ok(/gap-3 p-3 rounded-2xl/.test(block));
});

check('the icon badge was trimmed down', () => {
    assert.ok(!/p-3\.5 rounded-\[18px\]/.test(block), 'the old, larger icon badge must not still be present');
    assert.ok(/p-2\.5 rounded-2xl/.test(block));
    assert.ok(/<item\.icon className="w-5 h-5"/.test(block));
});

check('the three cards (Verified Pros, Fixed Pricing, On-Time Service) still all render', () => {
    assert.ok(/Verified Pros/.test(block));
    assert.ok(/Fixed Pricing/.test(block));
    assert.ok(/On-Time Service/.test(block));
});

console.log(`\n${passed} why-rozsewa-compact checks passed.\n`);
