/**
 * Master-list item 1: "Lead ka UI Sewak jaisa karna hai". The lead request form
 * picked category / subcategory / service from dropdowns and date/time from a
 * calendar popup + hour/minute selects. It now uses the same card lists, date
 * chips and hourly slot grid as the Sewak/Local Expert flow and checkout.
 * The old <select required> attributes enforced the choices, so the submit
 * handler has to enforce them itself now.
 *
 *   node scripts/leadFormSewakStyleCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'LeadRequirementForm.jsx'), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

console.log('\nStep 1 is a card flow, not dropdowns');
check('category, subcategory and service are picked from cards', () => {
    assert.ok(/data-testid="lead-category-card"|testId="lead-category-card"/.test(src));
    assert.ok(/testId="lead-subcategory-card"/.test(src));
    assert.ok(/data-testid="lead-service-select"/.test(src));
});
check('the step-1 dropdowns are gone and each pick has a Change control', () => {
    assert.ok(!/placeholder="— Select a Service Category —"/.test(src));
    assert.ok(!/placeholder="— Select Subcategory —"/.test(src));
    assert.ok(!/placeholder="— Select Specific Sub-Service —"/.test(src));
    assert.ok((src.match(/>Change<\/button>/g) || []).length >= 1);
});
check('changing a pick still resets what depends on it (state wiring untouched)', () => {
    assert.ok(/setSelectedSubcategoryId\(""\);\s*\n\s*setSelectedServiceId\(""\);/.test(src.replace(/\r/g, '')));
});

console.log('\nDate and time use chips and an hourly grid');
check('date is a row of day chips', () => {
    assert.ok(/data-testid="lead-date-chip"/.test(src));
    assert.ok(/length: 14/.test(src));
});
check('time is an hourly slot grid that disables past hours today and keeps the hour/min state', () => {
    assert.ok(/data-testid="lead-time-slot"/.test(src));
    assert.ok(/setSelectedHour\(hh\); setSelectedMin\('00'\)/.test(src));
    assert.ok(/disabled=\{past\}/.test(src));
});

console.log('\nSubmit validates what the dropdowns used to enforce');
check('handleSubmit rejects a missing category, subcategory, service or time', () => {
    const fn = src.slice(src.indexOf('const handleSubmit'), src.indexOf('const handleSubmit') + 1200);
    assert.ok(/!selectedCategoryId \? 'a service category'/.test(fn));
    assert.ok(/subcategories\.length > 0 && !selectedSubcategoryId/.test(fn));
    assert.ok(/subServices\.length > 0 && !selectedServiceId/.test(fn));
    assert.ok(/!preferredTime \? 'a preferred time slot'/.test(fn));
});

console.log(`\n${passed} lead-form sewak-style checks passed.\n`);

// ---- header / intro card refresh ----
{
    const fs2 = require('fs');
    const text = fs2.readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'user', 'pages', 'LeadRequirementForm.jsx'), 'utf8');
    console.log('Professional header');
    check('the top bar shows a titled header with a completion ring instead of badges', () => {
        assert.ok(/Post a Requirement/.test(text));
        assert.ok(/role="progressbar"/.test(text) && /aria-valuenow=\{progressPercent\}/.test(text));
        assert.ok(!/Lead Request\s*\n\s*<\/span>/.test(text.replace(/\r/g, '')), 'the cramped LEAD REQUEST pill + "% Complete" text is gone');
    });
    check('the intro card uses equal-width trust tiles', () => {
        assert.ok(/grid grid-cols-3 gap-2\.5/.test(text));
        assert.ok(/KYC-checked experts/.test(text));
    });
    console.log(`\n${passed} lead-form checks passed (incl. header).\n`);
}
