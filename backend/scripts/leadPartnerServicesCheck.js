/**
 * Lead-based partners list services without a price, and a lead for one
 * specific service reaches the partners who do it.
 *
 * - The Services page asked a lead-based partner for a price per service;
 *   their work comes as leads they unlock, so they now just add services.
 * - A lead for a specific service reached no partner: the lead carries the
 *   catalog service id, a partner's services are names, and the two were
 *   compared directly.
 *
 *   node scripts/leadPartnerServicesCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
// Firebase replaced before anything loads it: a check never sends a push.
const fbPath = require.resolve('../config/firebase');
require.cache[fbPath] = { id: fbPath, filename: fbPath, loaded: true, exports: { messaging: () => ({ sendEachForMulticast: async () => { throw new Error('no pushes from a check'); } }) } };

const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Setting = require('../models/Setting');
const { Wallet } = require('../models/Wallet');
const { findEligibleProviders } = require('../controllers/leadController');

const root = path.join(__dirname, '..', '..');
const svcCtrl = fs.readFileSync(path.join(root, 'backend', 'controllers', 'serviceController.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx'), 'utf8');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const lean = (v) => ({ select() { return this; }, limit() { return this; }, lean: async () => v });

const id = () => new mongoose.Types.ObjectId();
const catalogId = id();
const category = { _id: id(), name: 'Electrician', services: [{ _id: catalogId, name: 'Fan Repair' }] };
const P = {
    pickedName: { _id: id(), shopName: 'picked by name', subServices: ['Fan Repair'] },
    pickedId: { _id: id(), shopName: 'picked by id', subServices: [String(catalogId)] },
    addedOnPage: { _id: id(), shopName: 'added on Services page', subServices: [] },
    everything: { _id: id(), shopName: 'never narrowed', subServices: [] },
    other: { _id: id(), shopName: 'does something else', subServices: ['AC Repair'] },
};
const own = [
    { providerId: P.addedOnPage._id, name: 'Fan  repair' },
    { providerId: P.other._id, name: 'AC Repair' },
];

(async () => {
    console.log = ((log) => (...a) => { if (!String(a[0]).startsWith('[LeadTargeting]') && !String(a[0]).startsWith('  ➔')) log(...a); })(console.log);
    Setting.findOne = async () => null;
    Provider.find = () => lean(Object.values(P));
    Wallet.find = () => lean(Object.values(P).map(p => ({ providerId: p._id, balance: 1000 })));
    Service.find = () => lean(own);
    Service.findById = () => lean({ _id: catalogId, name: 'Fan Repair' });
    const lead = { _id: id(), categoryId: category._id, location: { coordinates: [75.8, 22.7] } };
    const names = (ids) => Object.entries(P).filter(([, p]) => ids.some(x => String(x) === String(p._id))).map(([k]) => k).sort();

    await check('a lead for a specific service reaches every partner who does it', async () => {
        const got = names(await findEligibleProviders({ ...lead, serviceId: catalogId }, category));
        assert.deepStrictEqual(got, ['addedOnPage', 'everything', 'pickedId', 'pickedName']);
    });
    await check('the same holds when the lead names the service by its subService id', async () => {
        const got = names(await findEligibleProviders({ ...lead, subServiceId: String(catalogId) }, category));
        assert.deepStrictEqual(got, ['addedOnPage', 'everything', 'pickedId', 'pickedName']);
    });
    await check('a lead with no specific service still goes to the whole category', async () => {
        assert.strictEqual((await findEligibleProviders(lead, category)).length, 5);
    });

    await check('server: a lead-based partner saves a service without a price; others still need one', async () => {
        assert.ok(/const leadBased = provider\?\.providerCategory !== 'sewak' && catalog\.category\.businessModel === 'lead';/.test(svcCtrl));
        assert.ok(/const priceError = leadBased \? null : servicePriceError\(price\);/.test(svcCtrl));
        assert.ok(/price: leadBased \? 0 : Number\(price\),/.test(svcCtrl));
        // editing can no longer set 0 or a negative price on a priced service
        const upd = svcCtrl.slice(svcCtrl.indexOf('const updateService'));
        assert.ok(/const priceError = servicePriceError\(req\.body\.price\);/.test(upd));
        assert.ok(/leadBased = !isSewak && provider\?\.vendorType\?\.businessModel === 'lead';\s*res\.json\(\{[^}]*leadBased \}\)/.test(svcCtrl));
    });
    await check('page: lead-based partners get no price box, no combos, and leads wording', async () => {
        assert.ok(/\{!leadBased && \(<>\s*<label[^>]*>\s*Service Price \(₹\) \*/.test(page));
        assert.ok(/if \(!leadBased\) \{\s*if \(form\.price === ""/.test(page));
        assert.ok(/\.\.\.\(leadBased \? \{\} : \{ price: Number\(form\.price\) \|\| 0 \}\)/.test(page));
        // Combos tab only to manage combos made before the category moved to leads.
        assert.ok(/\{\(!leadBased \|\| combos\.length > 0\) && \(\s*<div className="flex p-1 bg-muted rounded-xl">/.test(page));
        // A price set earlier still shows on the shop page, so it shows here too.
        assert.ok(/\{\(!leadBased \|\| s\.price > 0\) && <span[^>]*>Price ₹\{s\.price\}<\/span>\}/.test(page));
        assert.ok(/data-lead-based-note/.test(page) && /You get leads for this/.test(page));
    });
    await check('page: a service under "Other services" can be added (no subcategory demanded)', async () => {
        assert.ok(/const inNoSubcategory = catalog\.some\(c => nameKey\(c\.name\) === nameKey\(finalName\) && !c\.subcategory && !c\.subcategoryId\);/.test(page));
        assert.ok(/!form\.subcategory && !inNoSubcategory\) newErrors\.subcategory/.test(page));
    });

    console.log(`\n${passed} lead partner services checks passed.`);
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
