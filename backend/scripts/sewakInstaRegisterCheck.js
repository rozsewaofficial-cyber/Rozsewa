/**
 * A Sewak can join Insta Work while registering: Sewak registration offers
 * the Insta services available to Sewaks (admin-fixed rate), and the server
 * saves the chosen ones (active, Sewak-offered only, at the Sewak rate) with
 * Insta Work on. Partner registration is unchanged.
 *
 *   node scripts/sewakInstaRegisterCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'SewakRegister.jsx');
const partnerPage = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderRegister.jsx');
const ctrl = read('backend', 'controllers', 'providerController.js');

const sewakStart = ctrl.indexOf('const registerSewak = async');
const registerSewak = ctrl.slice(sewakStart, ctrl.indexOf('\n};', sewakStart));
const partnerStart = ctrl.indexOf('const registerProvider = async');
const registerProvider = ctrl.slice(partnerStart, ctrl.indexOf('\n};', partnerStart));

check('Sewak registration offers Insta Work with the Sewak services', () => {
    assert.ok(page.includes('API.get("/insta/services"'));
    assert.ok(page.includes('sv.availableFor.includes("sewak")'));
    assert.ok(/\{instaCatalog\.length > 0 && \(\s*<div[^>]*data-insta-register>/.test(page));
});
check('ticking Insta Work needs at least one service', () => {
    assert.ok(page.includes('if (formData.instaWork && instaCatalog.length > 0 && !(formData.instaServices || []).length) {'));
});
check('the server saves only active, Sewak-offered services at the admin rate, with Insta Work on', () => {
    assert.ok(/InstaService\.find\(\{ _id: \{ \$in: ids \}, isActive: true, availableFor: 'sewak' \}\)/.test(registerSewak));
    assert.ok(registerSewak.includes('.filter(svc => svc.servesCity(city));'), 'only services offered in the Sewak city');
    assert.ok(/Pricing\.resolveProviderRate\(\{ service: svc, providerCategory: 'sewak' \}\)/.test(registerSewak));
    assert.ok(registerSewak.includes('if (services.length) instaWork = { enabled: true, services };'));
    assert.ok(registerSewak.includes('...(instaWork ? { instaWork } : {}),'));
});
check('only Sewak registration — partner registration is untouched', () => {
    assert.ok(!/instaServices/.test(registerProvider));
    assert.ok(!/data-insta-register/.test(partnerPage));
});

console.log(`\n${passed} sewak insta-at-registration checks passed.`);
