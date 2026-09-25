/**
 * User Report note (item 42): City-wise, date-wise, Sewak-wise, and
 * Provider-wise filters. AdminUsers.jsx was customer-only (adminUserScope
 * hardcoded role: 'customer', with no city/date support at all) — Sewak and
 * Partner aren't User roles, they're the Provider model's providerCategory,
 * so satisfying "Sewak-wise"/"Provider-wise" meant a type switch to the
 * Provider collection AdminProviders.jsx already manages (confirmed with the
 * user), not a new field on User.
 *
 * These pin: adminUserScope gained city/date without touching its existing
 * role/status/search behavior; getUserStats now reports a city list the
 * same way getProviderStats already does; the frontend's three type tabs
 * each route to the right endpoint (User for customer, Provider filtered by
 * category for partner/sewak); and a Provider row never gets the
 * customer-only block/delete actions, since those hit /admin/users/:id
 * endpoints that don't apply to a Provider document.
 *
 *   node scripts/userReportFilterCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const controller = read('controllers/adminController.js');
const ui = feRead('modules/admin/pages/AdminUsers.jsx');

console.log('\nadminUserScope narrows by city and a registration date range, on top of its existing behavior');

check('city is a case-insensitive exact match, same convention as adminProviderScope', () => {
    const fn = sliceFn(controller, 'const adminUserScope');
    assert.ok(/query\.city = new RegExp\(`\^\$\{escape\(params\.city\)\}\$`, 'i'\)/.test(fn));
});

check('a date range narrows by createdAt with inclusive day bounds', () => {
    const fn = sliceFn(controller, 'const adminUserScope');
    assert.ok(/query\.createdAt\.\$gte = new Date\(new Date\(from\)\.setHours\(0, 0, 0, 0\)\)/.test(fn));
    assert.ok(/query\.createdAt\.\$lte = new Date\(new Date\(to\)\.setHours\(23, 59, 59, 999\)\)/.test(fn));
});

check('the hardcoded customer role and existing status/search filtering are untouched', () => {
    const fn = sliceFn(controller, 'const adminUserScope');
    assert.ok(/const query = \{ role: 'customer' \}/.test(fn));
    assert.ok(/status === 'active'/.test(fn) && /status === 'blocked'/.test(fn));
});

console.log('\ngetUserStats reports the cities the filter dropdown needs, like getProviderStats already does');

check('cities come from User.distinct scoped the same way the counts are', () => {
    const fn = sliceFn(controller, 'const getUserStats');
    assert.ok(/User\.distinct\('city', scope\)/.test(fn));
    assert.ok(/cities: cities\.filter\(Boolean\)\.sort\(\)/.test(fn));
});

console.log('\nThe admin screen offers Customer/Partner/Sewak tabs that route to the right collection');

check('three type tabs exist and drive state', () => {
    assert.ok(/key: "customer", label: "Customers"/.test(ui));
    assert.ok(/key: "partner", label: "Partners"/.test(ui));
    assert.ok(/key: "sewak", label: "Sewaks"/.test(ui));
    assert.ok(/onClick=\{\(\) => setUserType\(t\.key\)\}/.test(ui));
});

check('customer type calls /admin/users, partner/sewak call /admin/providers with category', () => {
    const fn = sliceFn(ui, 'const fetchUsers');
    assert.ok(/API\.get\("\/admin\/users",/.test(fn));
    assert.ok(/API\.get\("\/admin\/providers",/.test(fn));
    assert.ok(/const providerParams = \{ category: userType,/.test(fn));
});

check('a Provider row is normalized into the table\'s existing fields, not a second table', () => {
    const fn = sliceFn(ui, 'const normalizeProvider');
    assert.ok(/name: p\.ownerName \|\| p\.shopName/.test(fn));
    assert.ok(/role: p\.providerCategory === 'sewak' \? 'sewak' : 'partner'/.test(fn));
    assert.ok(/isProviderRow: true/.test(fn));
});

check('customer-only Block/Details/Delete actions never render for a Provider row', () => {
    assert.ok(/user\.isProviderRow \? \(/.test(ui));
    assert.ok(/Managed in Providers/.test(ui));
});

check('switching type resets the page and clears the city filter, since the two types don\'t share a city list', () => {
    assert.ok(/setCurrentPage\(1\);\s*\n\s*setCityFilter\(""\);\s*\n\s*\}, \[userType\]\);/.test(ui));
});

console.log('\nA superseded fetch (type/city/date changing before the previous one resolves) never wins or errors');

check('every response and error is checked against the latest request before touching state', () => {
    const fn = sliceFn(ui, 'const fetchUsers');
    assert.ok(/const mySeq = \+\+fetchSeqRef\.current/.test(fn));
    assert.ok((fn.match(/if \(mySeq !== fetchSeqRef\.current\) return;/g) || []).length >= 2,
        'both the customer branch and the provider branch need the guard, not just one');
});

check('a stale request\'s rejection is swallowed instead of surfacing a spurious "Fetch Failed" toast', () => {
    const fn = sliceFn(ui, 'const fetchUsers');
    const catchBlock = fn.slice(fn.indexOf('} catch (err) {'));
    assert.ok(/if \(mySeq !== fetchSeqRef\.current\) return;/.test(catchBlock.split('toast(')[0]),
        'the guard has to run before the toast, or a late failure from an abandoned request still shows one');
});

console.log(`\n${passed} user-report-filter checks passed.\n`);
