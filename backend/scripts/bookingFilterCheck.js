/**
 * The admin Bookings screen could filter by status and search by name/mobile/
 * service, but had no way to narrow by when a booking was scheduled or which
 * city it was in — every booking ever made stayed one long, unbroken list.
 *
 * These pin that adminBookingScope (shared by the list and the stats, so a
 * tab's count and the table under it never describe two different sets) now
 * accepts a date range over bookingDate and a city, that city resolves through
 * the provider serving the booking (a booking has no city field of its own),
 * that a supervisor's team scoping intersects with a city filter instead of
 * being silently overwritten by it, and that the UI actually offers both.
 *
 *   node scripts/bookingFilterCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const controller = read('controllers/adminController.js');
const ui = feRead('modules/admin/pages/AdminBookings.jsx');

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

console.log('\nThe scope both the list and the stats share understands date and city');

check('a date range narrows by bookingDate, not createdAt', () => {
    const fn = sliceFn(controller, 'const adminBookingScope');
    assert.ok(/query\.bookingDate = \{\}/.test(fn), 'the field a booking is actually scheduled for');
    assert.ok(/query\.bookingDate\.\$gte = String\(from\)/.test(fn) && /query\.bookingDate\.\$lte = String\(to\)/.test(fn));
});

check('city resolves through the provider serving the booking', () => {
    const fn = sliceFn(controller, 'const adminBookingScope');
    assert.ok(/Provider\.find\(\{ city: new RegExp/.test(fn),
        'a booking has no city of its own to filter on directly');
    assert.ok(/query\.providerId = \{ \$in: cityProviderIds \}/.test(fn));
});

check("a supervisor's team scope intersects with a city filter instead of being overwritten by it", () => {
    const fn = sliceFn(controller, 'const adminBookingScope');
    const supervisorBlock = fn.slice(fn.indexOf("role === 'supervisor'"));
    assert.ok(/cityProviderIds\s*\n?\s*\? teamProviderIds\.filter/.test(supervisorBlock),
        'or a supervisor filtering to one city could be shown bookings from another team entirely');
});

check('getBookingStats reports the cities a filter dropdown needs', () => {
    const fn = sliceFn(controller, 'const getBookingStats');
    assert.ok(/Provider\.distinct\('city'\)/.test(fn));
    assert.ok(/cities: cities\.filter\(Boolean\)\.sort\(\)/.test(fn));
});

console.log('\nThe admin can actually set both from the Bookings screen');

check('the city select and both date inputs exist and drive state', () => {
    assert.ok(/value=\{cityFilter\}/.test(ui) && /onChange=\{\(e\) => setCityFilter/.test(ui));
    assert.ok(/type="date"[\s\S]{0,80}value=\{dateFrom\}/.test(ui));
    assert.ok(/type="date"[\s\S]{0,80}value=\{dateTo\}/.test(ui));
});

check('changing them re-fetches, and resets back to page one', () => {
    assert.ok(/\[searchTerm, filter, cityFilter, dateFrom, dateTo\]/.test(ui), 'pagination reset effect');
    assert.ok(/\[searchTerm, filter, cityFilter, dateFrom, dateTo, currentPage\]/.test(ui), 'fetch effect');
});

check('the list, the stats, and CSV export all carry the same city/date params', () => {
    const fn = sliceFn(ui, 'const fetchBookings');
    assert.ok((fn.match(/cityFilter !== "all" \? \{ city: cityFilter \} : \{\}/g) || []).length >= 2,
        'both the list call and the stats call');
    const exportFn = sliceFn(ui, 'const handleExport');
    assert.ok(/cityFilter !== "all" \? \{ city: cityFilter \} : \{\}/.test(exportFn),
        'an export should reflect what the table is actually showing');
});

console.log(`\n${passed} booking-filter checks passed.\n`);
