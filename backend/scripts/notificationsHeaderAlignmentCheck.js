/**
 * Customer request: "mark as read and clear all ko upr karo and alignment
 * sahi karo" — the Notifications page header used flex-col below the `sm`
 * breakpoint, so on mobile the Mark Read / Clear All buttons wrapped onto
 * their own row below the title instead of sitting alongside it.
 *
 * Fixed by keeping the header a single row on every screen size, and
 * dropping the button labels to icon-only below `sm` (title attribute kept
 * for accessibility) so two buttons plus the back arrow and title all fit
 * without the title getting squeezed into an unreadable truncation.
 *
 *   node scripts/notificationsHeaderAlignmentCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Notifications.jsx');
const idx = page.indexOf('{/* Header */}');
const block = page.slice(idx, idx + 2200);

console.log('\nThe header stays one row on mobile instead of wrapping the action buttons below it');

check('the header row is no longer flex-col on small screens', () => {
    assert.ok(!/flex flex-col sm:flex-row/.test(block),
        'flex-col was what pushed Mark Read / Clear All onto their own row on mobile');
    assert.ok(/flex items-center justify-between/.test(block));
});

check('the action buttons are icon-only on mobile, with the label reappearing from sm upward', () => {
    assert.ok(/title="Mark Read"/.test(block) && /<span className="hidden sm:inline">Mark Read<\/span>/.test(block));
    assert.ok(/title="Clear All"/.test(block) && /<span className="hidden sm:inline">Clear All<\/span>/.test(block));
});

check('the title/back-button group can shrink without pushing the buttons off-row', () => {
    assert.ok(/min-w-0/.test(block), 'without min-w-0 a long title could force the row to overflow instead of truncating');
});

console.log(`\n${passed} notifications-header-alignment checks passed.\n`);
