/**
 * A partner who picked only some of its category's services is still listed
 * under the category ("All Services"), but only the picked services show on
 * its shop page and can be booked. An admin editing the category no longer
 * overwrites every provider's pick with the whole list.
 *
 *   node scripts/partnerServiceScopeCheck.js
 *
 * Runs the real code with the models stubbed; no database needed.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Combo = require('../models/Combo');
const { serviceScopeFor, comboInScope } = require('../utils/providerServiceScope');
const { getPublicServiceByProvider } = require('../controllers/homeController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const id = () => new mongoose.Types.ObjectId();
const read = (r) => fs.readFileSync(path.join(__dirname, '..', r), 'utf8');

const fanCatalog = { _id: id(), name: 'Fan Repair' };
const acCatalog = { _id: id(), name: 'AC Repair' };
const categoryServices = [fanCatalog, acCatalog];
const fan = { _id: id(), name: 'Fan Repair', price: 299 };
const ac = { _id: id(), name: 'AC Repair', price: 599 };

(async () => {
    await check('no pick means the whole category', async () => {
        assert.strictEqual(serviceScopeFor({ subServices: [] }, categoryServices), null);
        assert.strictEqual(serviceScopeFor({}, categoryServices), null);
    });

    await check('a pick stored by name matches the partner\'s own copy, case-insensitively', async () => {
        const offers = serviceScopeFor({ subServices: ['fan repair '] }, categoryServices);
        assert.ok(offers(fan));
        assert.ok(!offers(ac));
    });

    await check('a pick stored as a catalog id matches the own copy by the catalog name', async () => {
        const offers = serviceScopeFor({ subServices: [String(fanCatalog._id)] }, categoryServices);
        assert.ok(offers(fan));
        assert.ok(offers(fanCatalog));
        assert.ok(!offers(ac));
    });

    await check('a combo counts only when every service in it is picked', async () => {
        const offers = serviceScopeFor({ subServices: ['Fan Repair'] }, categoryServices);
        assert.ok(comboInScope(offers, { services: [fan] }));
        assert.ok(!comboInScope(offers, { services: [fan, ac] }));
        assert.ok(comboInScope(null, { services: [fan, ac] }));
    });

    await check('the shop page lists only the picked services and combos', async () => {
        const provider = { _id: id(), providerCategory: 'partner', subServices: ['Fan Repair'], vendorType: { services: categoryServices } };
        Provider.findById = () => ({ populate: async () => provider });
        Service.find = async () => [fan, ac];
        Combo.find = () => ({ populate: async () => [{ name: 'Fan only', services: [fan] }, { name: 'Fan + AC', services: [fan, ac] }] });
        const r = { status() { return r; }, json(b) { r.body = b; return r; } };
        await getPublicServiceByProvider({ params: { providerId: String(provider._id) } }, r);
        assert.deepStrictEqual(r.body.services.map(s => s.name), ['Fan Repair']);
        assert.deepStrictEqual(r.body.combos.map(c => c.name), ['Fan only']);

        provider.subServices = [];
        await getPublicServiceByProvider({ params: { providerId: String(provider._id) } }, r);
        assert.deepStrictEqual(r.body.services.map(s => s.name), ['Fan Repair', 'AC Repair'], 'no pick: everything');
    });

    await check('the listing still includes the partner, priced from its picked services', async () => {
        const home = read('controllers/homeController.js');
        const fn = home.slice(home.indexOf('const getPublicProviders'), home.indexOf('const getPublicServiceByProvider'));
        assert.ok(/const offers = serviceScopeFor\(p, p\.vendorType\?\.services\);/.test(fn));
        assert.ok(/\.filter\(s => !offers \|\| offers\(s\)\)/.test(fn));
        assert.ok(/availability subServices'\)\s*\.populate\('vendorType', 'name icon services'\)/.test(fn));
    });

    await check('booking a service the partner did not pick is refused', async () => {
        const booking = read('controllers/bookingController.js');
        assert.ok(/const offers = serviceScopeFor\(specificProvider, cat\?\.services\);/.test(booking));
        assert.ok(/This provider does not offer: \$\{notOffered\.join\(', '\)\}/.test(booking));
    });

    await check('an admin category edit no longer overwrites providers\' picks', async () => {
        const admin = read('controllers/adminController.js');
        assert.ok(!/\$set: \{ subServices: serviceIds \}/.test(admin));
        assert.ok(!/provider\.subServices = newCat\.services\.map/.test(admin));
        assert.ok(/'subServices\.\$\[picked\]': to/.test(admin), 'a renamed service is renamed in the picks');
        assert.ok(!/provider\.subServices = newCat\.services\.map/.test(read('controllers/providerController.js')));
    });

    console.log(`\n${passed} partner-service-scope checks passed.\n`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
