/**
 * 24/7 is a partner setting: a Sewak has no 24/7 option anywhere (Settings
 * tile, Timing switch, dashboard Emergency button, registration checkbox) and
 * the server refuses it for a Sewak. Partners keep theirs.
 *
 *   node scripts/sewakNo24x7Check.js
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

check('Settings: no 24/7 Service tile for a Sewak', () => {
    assert.ok(/\{!isSewak && \(\s*<button[\s\S]{0,120}handleToggleStatus\('emergency'\)/.test(settings));
    assert.ok(settings.includes("const isSewak = provider?.providerCategory === 'sewak';"));
});
check('Timing: no 24/7 switch for a Sewak, and Save Schedule sends no 24/7', () => {
    assert.ok(/\{!isSewak && \(\s*<div className="rounded-2xl border bg-card p-4 mb-4">/.test(timing));
    assert.ok(timing.includes('await API.put("/provider/profile", { availability: availabilityArray });'));
});
check('Dashboard: no Emergency button for a Sewak', () => {
    assert.ok(/\{user\?\.providerCategory !== 'sewak' && \(\s*<div className="relative flex-1 md:flex-none w-full sm:w-auto" ref=\{emergencyMenuRef\}>/.test(dash));
});
check('Sewak registration: no 24/7 checkbox', () => {
    assert.ok(!/is24x7/.test(register));
});
check('server: a Sewak cannot turn 24/7 on (register, status, profile)', () => {
    const start = ctrl.indexOf('const registerSewak = async');
    const sewakReg = ctrl.slice(start, ctrl.indexOf('\n};', start));
    assert.ok(/is24x7: false,\s*isEmergencyEnabled: false,/.test(sewakReg));
    assert.ok(ctrl.includes("if (isEmergencyEnabled !== undefined && provider.providerCategory !== 'sewak') {"));
    assert.ok(ctrl.includes("if (req.body.is24x7 !== undefined && provider.providerCategory !== 'sewak') {"));
});
check("a Sewak's shop page has no 24x7 Emergency tab (it would always be empty)", () => {
    assert.ok(/\{provider\.providerCategory !== 'sewak' && \(\s*<button onClick=\{\(\) => setServiceFilter\('24x7'\)\}/.test(shop));
});

console.log(`\n${passed} sewak 24/7 checks passed.`);
