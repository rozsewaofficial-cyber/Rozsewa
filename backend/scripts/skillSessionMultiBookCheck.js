/**
 * Skill Sessions: "Select multiple" books several pending sessions with one
 * date and time — one booking per service through the same endpoint (the
 * server refuses a service that already has a session) — while the single
 * Book Session flow stays as it was. The sheet sits above the bottom nav.
 *
 *   node scripts/skillSessionMultiBookCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderSkillSessions.jsx');
const ctrl = read('backend', 'controllers', 'skillSessionController.js');

check('"Select multiple" shows when more than one session needs booking', () => {
    assert.ok(/\{pending\.length > 1 && \(\s*<button[\s\S]{0,200}data-skill-multi-toggle/.test(page));
});
check('the picked sessions are booked one by one through the existing endpoint', () => {
    assert.ok(/for \(const row of sheetRows\) \{\s*try \{\s*await API\.post\("\/skill-sessions\/book", \{\s*serviceName: row\.serviceName,/.test(page));
    assert.ok(/const sheetRows = multiRows \|\| \(booking \? \[booking\] : null\);/.test(page));
});
check('single Book Session is unchanged outside multiple selection', () => {
    assert.ok(/\) : \(\s*<button\s*onClick=\{\(\) => openBooking\(row\)\}[\s\S]{0,200}Book Session/.test(page));
    assert.ok(page.includes('"Confirm Booking"'));
});
check('the server still refuses a second session for the same service', () => {
    assert.ok(/status: \{ \$in: ACTIVE_STATUSES \}[\s\S]{0,80}if \(existing\)/.test(ctrl));
});
check("sessions booked for the same day don't land at the same time for one Sewak", () => {
    const alloc = read('backend', 'utils', 'skillSessionAllocator.js');
    const jobs = read('backend', 'cron', 'skillSessionJobs.js');
    assert.ok(/sewakId = null,\s*excludeSessionId = null/.test(alloc));
    assert.ok(/for \(const slot of slots\) \{\s*if \(clashes\(slot\)\) continue;/.test(alloc));
    assert.ok(/preferredTimeOfDay,\s*sewakId: provider\._id\s*\}\);/.test(ctrl), 'new booking');
    assert.ok(/sewakId: provider\._id,\s*excludeSessionId: session\._id/.test(ctrl), 'capacity retry');
    assert.ok(/preferredTimeOfDay: resolvedTimeOfDay,\s*sewakId: parent\.sewakId/.test(ctrl), 're-session');
    assert.ok(/sewakId: session\.sewakId,\s*excludeSessionId: session\._id/.test(jobs), 'pending retry job');
});
check('the booking sheet is above the bottom nav and scrolls', () => {
    assert.ok(page.includes('fixed inset-0 z-[60]'));
    assert.ok(page.includes('max-h-[90dvh] overflow-y-auto'));
});

console.log(`\n${passed} skill session multi-book checks passed.`);
