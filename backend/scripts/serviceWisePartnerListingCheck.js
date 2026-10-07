/**
 * Picking a service (category -> subcategory -> service) lists only the
 * partners that offer that service.
 *
 * The listing went by Provider.subServices alone: an empty list meant "the
 * whole category", and old admin category edits had filled every partner's
 * list with all of the category's service ids. So every partner showed under
 * every service. A partner is now listed for a service only when it has a
 * priced service of its own with that name (inside its picked list, if any),
 * and the card shows that price.
 *
 *   node scripts/serviceWisePartnerListingCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
const assert = require('assert');
const mongoose = require('mongoose');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Combo = require('../models/Combo');
const ProviderBanner = require('../models/ProviderBanner');
const { getPublicProviders } = require('../controllers/homeController');
const { serviceNameKey } = require('../utils/providerServiceScope');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const id = () => new mongoose.Types.ObjectId();

const fanId = id();
const acId = id();
const category = { _id: id(), name: 'Electrician', services: [{ _id: fanId, name: 'Fan Repair' }, { _id: acId, name: 'AC Repair' }] };

const partner = (shopName, subServices) => {
    const doc = { _id: id(), shopName, providerCategory: 'partner', status: 'verified', isOnline: true, availability: [], subServices, vendorType: category };
    doc.toObject = () => ({ ...doc });
    return doc;
};
// Picked one service and offers it.
const fanOnly = partner('Fan Only', ['Fan Repair']);
// The old admin sync filled the list with every catalog id; offers only AC.
const acOnly = partner('AC Only', [String(fanId), String(acId)]);
// Never picked anything; offers Fan Repair under a decorated name.
const decorated = partner('Decorated Names', []);

const ownServices = new Map([
    [String(fanOnly._id), [{ _id: id(), name: 'Fan Repair', price: 299 }, { _id: id(), name: 'AC Repair', price: 650 }]],
    [String(acOnly._id), [{ _id: id(), name: 'AC Repair', price: 699 }]],
    [String(decorated._id), [{ _id: id(), name: '✨ Fan  Repair', price: 249 }]],
]);

Category.findOne = (q) => {
    const hit = q && (q.name || q['services._id']) ? category : null;
    return { select: () => ({ lean: async () => hit }), then: (r) => r(hit) };
};
Provider.find = () => {
    const chain = { select: () => chain, populate: () => chain, sort: () => chain, then: (r) => r([fanOnly, acOnly, decorated]) };
    return chain;
};
Service.find = (q) => ({ select: async () => ownServices.get(String(q.providerId)) || [] });
Service.findById = () => ({ select: () => ({ lean: async () => null }) });
Combo.find = () => ({ select: async () => [] });
// Chainable either way the banner boost reads it (with or without .limit()).
ProviderBanner.find = () => {
    const chain = { select: () => chain, limit: () => chain, lean: async () => [] };
    return chain;
};

const list = (query) => new Promise((resolve, reject) => {
    const res = { status() { return this; }, json: resolve };
    getPublicProviders({ query: { category: 'Electrician', mode: 'partner', ...query } }, res).catch(reject);
});
const names = (rows) => rows.map(p => p.shopName).sort();

(async () => {
    await check('without a service, the category lists every partner', async () => {
        assert.deepStrictEqual(names(await list({})), ['AC Only', 'Decorated Names', 'Fan Only']);
    });
    await check('Fan Repair lists only partners that offer it, at their price', async () => {
        const rows = await list({ serviceName: 'Fan Repair', serviceId: String(fanId) });
        assert.deepStrictEqual(names(rows), ['Decorated Names', 'Fan Only']);
        assert.strictEqual(rows.find(p => p.shopName === 'Fan Only').startingPrice, 299);
        assert.strictEqual(rows.find(p => p.shopName === 'Decorated Names').matchedService.price, 249);
    });
    await check('AC Repair skips a partner that has it but did not pick it', async () => {
        assert.deepStrictEqual(names(await list({ serviceName: 'AC Repair' })), ['AC Only']);
    });
    await check('an id alone (a category catalog entry) is resolved to its name', async () => {
        assert.deepStrictEqual(names(await list({ serviceId: String(acId) })), ['AC Only']);
    });
    await check('a service nobody offers lists nobody', async () => {
        assert.deepStrictEqual(names(await list({ serviceName: 'Geyser Repair' })), []);
    });
    await check('names match ignoring emoji, case and spacing', async () => {
        assert.strictEqual(serviceNameKey('✨ Fan  Repair'), serviceNameKey('fan repair'));
        assert.notStrictEqual(serviceNameKey('Fan Repair'), serviceNameKey('AC Repair'));
    });

    console.log(`\n${passed} service-wise listing checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
