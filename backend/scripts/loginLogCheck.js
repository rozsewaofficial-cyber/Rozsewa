/**
 * System Login Report needed a real audit trail of admin-panel sign-ins —
 * previously "System Logs" showed synthetic data built from recent Provider
 * registrations and Bookings, mislabeled with fake login/approval tags, so
 * there was no way to actually answer "who logged in, from which city, and
 * when."
 *
 * These pin that only staff roles (admin/superadmin/supervisor/field_staff/
 * employee) ever get a LoginLog row (a customer or provider signing in must
 * not), that a logging failure can never break the login itself, that the
 * city/date/time-of-day filters on GET /admin/login-logs are wired correctly
 * (including the IST-aware time-of-day aggregation, since createdAt is UTC),
 * and that the admin UI actually offers city/date/time filters.
 *
 *   node scripts/loginLogCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const model = read('models/LoginLog.js');
const auth = read('controllers/authController.js');
const admin = read('controllers/adminController.js');
const routes = read('routes/adminRoutes.js');
const ui = feRead('modules/admin/pages/AdminActivityLog.jsx');

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

console.log('\nOnly a staff login is ever recorded, and logging can never break login');

check('LoginLog stores who, what role, what city, and when', () => {
    assert.ok(/userId:.*required: true/.test(model));
    assert.ok(/role:.*required: true/.test(model));
    assert.ok(/city:/.test(model));
    assert.ok(/timestamps: true/.test(model), 'createdAt doubles as the login timestamp');
});

check('recordStaffLogin gates on the staff role list', () => {
    const fn = sliceFn(auth, 'const recordStaffLogin');
    assert.ok(/STAFF_ROLES\.includes\(user\.role\)/.test(fn));
    assert.ok(/const STAFF_ROLES = \[[^\]]*'admin'[^\]]*'superadmin'[^\]]*'supervisor'[^\]]*'field_staff'[^\]]*'employee'[^\]]*\]/.test(auth),
        'customer and provider are deliberately not in this list');
});

check('a logging failure is swallowed, never thrown', () => {
    const fn = sliceFn(auth, 'const recordStaffLogin');
    assert.ok(/try\s*\{[\s\S]*catch\s*\(err\)/.test(fn));
});

check('authUser calls it without awaiting, so logging can never slow down login', () => {
    const fn = sliceFn(auth, 'const authUser');
    assert.ok(/(?<!await )recordStaffLogin\(user, req\);/.test(fn));
});

console.log('\nGET /admin/login-logs filters city, date range, and IST time-of-day correctly');

check('city filter is a case-insensitive exact match, not a substring', () => {
    const fn = sliceFn(admin, 'const getLoginLogs');
    assert.ok(/new RegExp\(`\^\$\{escapeRx\(city\)\}\$`, 'i'\)/.test(fn));
});

check('date range filters createdAt with inclusive day bounds', () => {
    const fn = sliceFn(admin, 'const getLoginLogs');
    assert.ok(/setHours\(0, 0, 0, 0\)/.test(fn) && /setHours\(23, 59, 59, 999\)/.test(fn));
});

check('time-of-day filtering extracts HH:MM in IST before matching, not raw UTC', () => {
    const fn = sliceFn(admin, 'const getLoginLogs');
    assert.ok(/\$dateToString.*format: '%H:%M'/.test(fn));
    assert.ok(/timezone: '\+05:30'/.test(fn), 'createdAt is UTC — a raw range would filter the wrong hour');
});

check('both the timed and untimed branches report X-Total-Count for pagination', () => {
    const fn = sliceFn(admin, 'const getLoginLogs');
    assert.ok((fn.match(/res\.set\('X-Total-Count'/g) || []).length >= 2);
});

check('getLoginLogCities feeds the filter dropdown', () => {
    const fn = sliceFn(admin, 'const getLoginLogCities');
    assert.ok(/LoginLog\.distinct\('city'\)/.test(fn));
});

check('both endpoints are admin-protected and the cities route is mounted first', () => {
    assert.ok(/router\.get\('\/login-logs\/cities', protect, admin, getLoginLogCities\)/.test(routes));
    assert.ok(/router\.get\('\/login-logs', protect, admin, getLoginLogs\)/.test(routes));
    const citiesIdx = routes.indexOf("router.get('/login-logs/cities'");
    const logsIdx = routes.indexOf("router.get('/login-logs',");
    assert.ok(citiesIdx !== -1 && logsIdx !== -1 && citiesIdx < logsIdx,
        'a bare /login-logs route mounted first could never be reached by /login-logs/cities');
});

console.log('\nThe admin can actually filter the Login Report from the UI');

check('a Login Report tab exists alongside the original Activity Feed', () => {
    assert.ok(/LoginReportTab/.test(ui));
    assert.ok(/Activity Feed/.test(ui) && /Login Report/.test(ui));
});

check('city, date range, and time range filters all drive state and refetch', () => {
    const fn = sliceFn(ui, 'const LoginReportTab');
    assert.ok(/value=\{cityFilter\}/.test(fn) && /onChange=\{\(e\) => setCityFilter/.test(fn));
    assert.ok(/type="date"[\s\S]{0,60}value=\{dateFrom\}/.test(fn) && /type="date"[\s\S]{0,60}value=\{dateTo\}/.test(fn));
    assert.ok(/type="time"[\s\S]{0,60}value=\{timeFrom\}/.test(fn) && /type="time"[\s\S]{0,60}value=\{timeTo\}/.test(fn));
    assert.ok(/\[cityFilter, dateFrom, dateTo, timeFrom, timeTo\]/.test(fn), 'fetchLogs dependency array');
});

check('the table shows a serial number per the handwritten note', () => {
    const fn = sliceFn(ui, 'const LoginReportTab');
    assert.ok(/Sr\. No\./.test(fn));
    assert.ok(/\{i \+ 1\}/.test(fn));
});

console.log(`\n${passed} login-log checks passed.\n`);
