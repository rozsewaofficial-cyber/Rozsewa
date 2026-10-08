/**
 * A service a partner adds is shown to customers and can be booked.
 *
 * A partner who picked some services at registration (Provider.subServices)
 * had every service they added later through Add Service hidden from their
 * shop page ("No specific services listed"), left out of the service-wise
 * listing, and refused at booking — the picked list was the only thing
 * checked. A partner's own service is now always one they offer (only
 * Sewaks ever had services made for them), and adding one also joins the
 * picked list.
 *
 *   node scripts/partnerAddedServicesShownCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { serviceScopeFor } = require('../utils/providerServiceScope');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

const partner = { _id: 'p1', subServices: ['Fan Repair'] };
const offers = serviceScopeFor(partner, []);

check("the partner's own added services are offered, whatever they picked", () => {
    assert.ok(offers({ _id: 's1', name: 'Fan Repair', providerId: 'p1' }));
    assert.ok(offers({ _id: 's2', name: 'Geyser Repair', providerId: 'p1' }), 'added later via Add Service');
    assert.ok(offers({ _id: 's3', name: 'Geyser Repair', providerId: { _id: 'p1' } }), 'populated owner too');
});

check('the picked list still limits catalog services that are not their own', () => {
    assert.ok(!offers({ _id: 'c1', name: 'Geyser Repair', providerId: null }));
    assert.ok(offers({ _id: 'c2', name: 'Fan Repair', providerId: null }));
    assert.ok(!offers({ _id: 'x', name: 'Geyser Repair', providerId: 'someone-else' }));
});

check('no picked list: everything, as before', () => {
    assert.strictEqual(serviceScopeFor({ _id: 'p1', subServices: [] }, []), null);
});

check('booking and listing read the owner, and Add Service keeps the picked list in step', () => {
    assert.ok(/\.select\('name providerId'\)/.test(read('controllers', 'bookingController.js')));
    assert.ok(/\.select\('name price image providerId'\)/.test(read('controllers', 'homeController.js')));
    assert.ok(/\$addToSet: \{ subServices: String\(name\)\.trim\(\) \}/.test(read('controllers', 'serviceController.js')));
});

console.log(`\n${passed} partner-added-services checks passed.`);
