/**
 * A Sewak has the 24/7 Service option, like a partner: Settings tile, Timing switch, dashboard Emergency button,
 * registration checkbox, the shop page's 24x7 tab, and the server saves it on register, status and profile.
 *
 *   node scripts/sewak24x7Check.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const pages = (f) => read('frontend', 'src', 'modules', 'provider', 'pages', f);
const settings = pages('ProviderSettings.jsx');
const timing = pages('ProviderAvailability.jsx');
const dash = pages('ProviderDashboard.jsx');
const register = pages('SewakRegister.jsx');
const ctrl = read('backend', 'controllers', 'providerController.js');
const shop = read('frontend', 'src', 'modules', 'user', 'pages', 'ShopDetail.jsx');

check('Settings: the 24/7 Service tile is shown to a Sewak too', () => {
    assert.ok(!/\{!isSewak && \(\s*<button[\s\S]{0,120}handleToggleStatus\('emergency'\)/.test(settings));
    assert.ok(settings.includes("handleToggleStatus('emergency')"));
});
check('Timing: the 24/7 switch is shown to a Sewak too', () => {
    assert.ok(!/\{!isSewak && \(\s*<div className="rounded-2xl border bg-card p-4 mb-4">/.test(timing));
});
check('Dashboard: the Emergency (24/7) button is shown to a Sewak too', () => {
    assert.ok(!/providerCategory !== 'sewak' && \(\s*<div className="relative flex-1 md:flex-none w-full sm:w-auto" ref=\{emergencyMenuRef\}>/.test(dash));
    assert.ok(dash.includes('ref={emergencyMenuRef}'));
});
check('Sewak registration: has the 24/7 checkbox', () => {
    assert.ok(/is24x7/.test(register));
});
check('Shop page: the 24x7 Emergency tab is not hidden for a Sewak', () => {
    assert.ok(!/providerCategory !== 'sewak' && \(\s*<button onClick=\{\(\) => setServiceFilter\('24x7'\)\}/.test(shop));
    assert.ok(shop.includes("setServiceFilter('24x7')"));
});
check('server: a Sewak can turn 24/7 on (register, status, profile)', () => {
    const start = ctrl.indexOf('const registerSewak = async');
    const registerBody = ctrl.slice(start, ctrl.indexOf('\nconst ', start + 10));
    assert.ok(/is24x7: is24x7 \|\| false/.test(registerBody), 'register keeps the Sewak\'s choice');
    assert.ok(!/isEmergencyEnabled !== undefined && provider\.providerCategory !== 'sewak'/.test(ctrl), 'status');
    assert.ok(!/req\.body\.is24x7 !== undefined && provider\.providerCategory !== 'sewak'/.test(ctrl), 'profile');
});

console.log(`\n${passed} sewak-24x7 checks passed.`);
