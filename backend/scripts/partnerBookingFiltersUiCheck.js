/**
 * Partner bookings: tabs fit a phone in one row (the Bookings page has four;
 * "Rejected" sat off-screen behind a sideways scroll), the filter card is
 * compact (dates side by side, Clear only when something is set), and the
 * date fields can be typed in — the hidden calendar used to cover the whole
 * field, so every tap opened the picker.
 *
 *   node scripts/partnerBookingFiltersUiCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'provider', 'components', 'RecentBookingsList.jsx'), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('tabs: one row, no sideways scroll; four tabs sized by content, two split evenly', () => {
    assert.ok(/<div className="flex w-full gap-1 p-1 bg-muted rounded-2xl sm:w-fit" data-booking-tabs>/.test(page));
    assert.ok(!/data-booking-tabs[^>]*overflow-x-auto/.test(page) && !/overflow-x-auto no-scrollbar" data-booking-tabs/.test(page));
    assert.ok(/tabIds\.length > 2 \? "flex-auto gap-1 px-1 text-\[11px\]" : "flex-1 gap-2 px-3 text-sm"/.test(page));
});
check('filters: search with icon, dates side by side, Clear only when a filter is set', () => {
    assert.ok(/data-booking-filters/.test(page) && /<Search className="pointer-events-none absolute left-3/.test(page));
    assert.ok(/<div className="grid grid-cols-2 gap-2 sm:flex-\[1\.4\]">/.test(page));
    assert.ok(/const filtersOn = !!\(filterCity \|\| fromDateDisplay \|\| toDateDisplay\);/.test(page));
    assert.ok(/\{filtersOn && \(\s*<button onClick=\{clearFilters\}/.test(page));
});
check('date fields stay typeable: the picker sits on the calendar icon only', () => {
    assert.ok(/<span className="absolute right-1 top-1\/2 flex h-8 w-8[^"]*">\s*<CalendarDays[^>]*\/>\s*<input\s+type="date"/.test(page));
    assert.ok(/e\.currentTarget\.showPicker\?\.\(\)/.test(page));
    assert.ok(!/className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/.test(page));
});

console.log(`\n${passed} partner booking filter UI checks passed.`);
