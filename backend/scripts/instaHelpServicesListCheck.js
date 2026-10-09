/**
 * Insta Work: the customer's first screen lists every Help Service the admin
 * has switched on — name, description, rate, whether it is offered Now and/or
 * Scheduled, and a Request button — instead of showing services only after a
 * mode is picked. The list comes from the existing /insta/services (admin's
 * service master); nothing is hardcoded, and it refreshes when the customer
 * returns to the tab. The partner's list shows each service's description.
 *
 *   node scripts/instaHelpServicesListCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const page = read('frontend', 'src', 'modules', 'user', 'pages', 'InstaWork.jsx');
const partnerPage = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderInstaWork.jsx');
const partnerCtrl = read('backend', 'controllers', 'instaProviderController.js');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('the list is the admin-managed services from /insta/services, not a hardcoded one', () => {
    assert.ok(/API\.get\(`\/insta\/services\$\{userCity/.test(page));
    const section = page.slice(page.indexOf('data-help-services>'), page.indexOf('Service list ----'));
    assert.ok(/\{services\.map\(\(s\) => \{/.test(section), 'rendered from the fetched services');
    assert.ok(!/name: "/.test(section), 'no service literals in the section');
});
check('each service: name, description, rate, Now / Scheduled status and a Request button', () => {
    const section = page.slice(page.indexOf('data-help-services>'), page.indexOf('Service list ----'));
    assert.ok(/\{s\.name\}/.test(section) && /\{s\.description\}/.test(section) && /\{rateLabel\(s\)\}/.test(section));
    assert.ok(/const now = s\.modes\?\.now !== false;/.test(section) && /const scheduled = s\.modes\?\.scheduled !== false;/.test(section));
    assert.ok(/onClick=\{\(\) => requestService\(s\)\}/.test(section) && /disabled=\{!bookable\}/.test(section));
});
check('Request opens booking in the first mode the service is offered in', () => {
    assert.ok(/const requestService = \(svc\) => \{\s*const m = svc\.modes\?\.now !== false \? "now" : "scheduled";\s*setMode\(m\);[\s\S]{0,80}pickService\(svc\);/.test(page));
});
check('empty state, and admin changes show when the customer returns to the tab', () => {
    assert.ok(/data-help-services-empty/.test(page) && /No help services in your area yet/.test(page));
    assert.ok(/document\.addEventListener\("visibilitychange", onVisible\)/.test(page));
    assert.ok(/document\.visibilityState === "visible"\) loadServices\(\)/.test(page));
});
check('responsive: one column on a phone, two from tablet up', () => {
    const section = page.slice(page.indexOf('data-help-services>'), page.indexOf('Service list ----'));
    assert.ok(/className="grid gap-3 sm:grid-cols-2"/.test(section));
});
check('partner list shows each service description', () => {
    assert.ok(/description: s\.description \|\| '',/.test(partnerCtrl));
    assert.ok(/\{svc\.description && <p[^>]*>\{svc\.description\}<\/p>\}/.test(partnerPage));
});

check('a city-limited service says so, and cannot be booked for another city', () => {
    const customerCtrl = read('backend', 'controllers', 'instaCustomerController.js');
    assert.ok(/cities: s\.cities \|\| \[\],/.test(customerCtrl));
    const job = customerCtrl.slice(customerCtrl.indexOf('const createJob'));
    assert.ok(/if \(!service\.servesCity\(city\)\) \{\s*return res\.status\(400\)/.test(job));
    assert.ok(job.indexOf('servesCity(city)') < job.indexOf("supplyModel)) {"), 'checked before anything else about the job');
    assert.ok(/\{s\.cities\?\.length > 0 && \(\s*<span[^>]*data-help-service-cities>\s*Only in \{s\.cities\.join\(", "\)\}/.test(page));
});

console.log(`\n${passed} insta help services list checks passed.`);
