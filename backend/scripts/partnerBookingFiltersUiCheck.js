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
    assert.ok(/<div role="tablist" aria-label="Bookings" className=\{`flex w-full rounded-2xl[^`]*\$\{tabIds\.length > 2 \? "gap-0\.5 p-1" : "gap-1\.5 p-1\.5"\}`\} data-booking-tabs>/.test(page));
    assert.ok(!/data-booking-tabs[^>]*overflow-x-auto/.test(page) && !/overflow-x-auto no-scrollbar" data-booking-tabs/.test(page));
    assert.ok(/tabIds\.length > 2 \? "flex-auto gap-0\.5 px-1 text-\[11px\] tracking-tight" : "flex-1 gap-2 px-3 text-sm"/.test(page));
});
check('New and Active stand out: own colour, filled when selected, counts always, pulse on waiting requests', () => {
    assert.ok(/pending: \{ id: "pending", label: "New", on: "bg-blue-600 text-white/.test(page));
    assert.ok(/active: \{ id: "active", label: "Active", on: "bg-emerald-600 text-white/.test(page));
    assert.ok(/\$\{selected \? tab\.on : tab\.off\}/.test(page) && /role="tab" aria-selected=\{selected\}/.test(page));
    assert.ok(/focus-visible:ring-2/.test(page) && /hover:bg-blue-50/.test(page));
    assert.ok(/\(count > 0 \|\| tab\.id === "pending" \|\| tab\.id === "active"\)/.test(page), 'New and Active show 0 too');
    assert.ok(/const waiting = tab\.id === "pending" && count > 0 && !selected;/.test(page) && /animate-ping/.test(page));
    // counts are the server's, refreshed on every event that moves a booking
    assert.ok(/API\.get\("\/bookings\/provider\/stats"\)/.test(page) && /setCounts\(tabCounts\)/.test(page));
    for (const e of ['NEW_BOOKING_REQUEST', 'BOOKING_TAKEN', 'COUNTER_DECISION', 'SCHEDULE_ACCEPTED', 'SCHEDULE_REJECTED', 'BOOKING_UPDATE', 'NEW_NOTIFICATION']) {
        assert.ok(new RegExp(`const events = \\[[^\\]]*"${e}"`).test(page), e);
    }
    assert.ok(/events\.forEach\(\(e\) => socket\.on\(e, handleSocketUpdate\)\)/.test(page) && /events\.forEach\(\(e\) => socket\.off\(e, handleSocketUpdate\)\)/.test(page));
});
check('counts: never a false "0" while loading, one refresh per burst, fresh on return', () => {
    assert.ok(/\{!loading && \(count > 0 \|\| tab\.id === "pending" \|\| tab\.id === "active"\) && \(/.test(page));
    assert.ok(/clearTimeout\(socketRefreshTimer\.current\);\s*socketRefreshTimer\.current = setTimeout\(\(\) => fetchBookings\(\), 400\);/.test(page));
    assert.ok(/document\.visibilityState === "visible"\) fetchBookings\(\)/.test(page) && /document\.addEventListener\("visibilitychange", onVisible\)/.test(page));
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
