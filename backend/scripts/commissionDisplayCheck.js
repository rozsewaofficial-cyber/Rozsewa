/**
 * Commission shown to admin and partner is the commission billing charges.
 *
 * Admin -> Providers -> View Profile showed "Effective Rate" from
 * Provider.commissionRate, a stored copy that defaulted to 10, and the
 * partner's Profile showed `commissionRate || 10`, while billing ran the
 * commission engine over Partner Program -> Commission Slab. Both screens now
 * read the engine's preview, which also returns the category's slabs.
 *
 *   node scripts/commissionDisplayCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Provider = require('../models/Provider');
const CommissionSlab = require('../models/CommissionSlab');
const PartnerProgram = require('../models/PartnerProgram');
const Setting = require('../models/Setting');
const ProviderSubscription = require('../models/ProviderSubscription');
const mongoose = require('mongoose');
const { getProviderCommissionPreview } = require('../controllers/v2CommissionController');

// No subscription for this partner, however the engine asks.
ProviderSubscription.findOne = () => { const p = Promise.resolve(null); p.populate = async () => null; p.session = () => p; return p; };
ProviderSubscription.find = () => { const p = Promise.resolve([]); p.populate = async () => []; p.session = () => p; return p; };
ProviderSubscription.updateMany = async () => ({});
const CAT = new mongoose.Types.ObjectId();
const PID = new mongoose.Types.ObjectId();

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

const electrician = { _id: CAT, name: 'Electrician' };
let slabs = [];
let provider;
const chain = (rows) => ({ sort: () => ({ lean: async () => rows, then: (r) => r(rows) }), lean: async () => rows });
CommissionSlab.find = (q) => {
    const rows = slabs.filter(s => String(s.category) === String(q.category));
    const sorted = [...rows].sort((a, b) => a.minAmount - b.minAmount);
    return { sort: () => { const p = Promise.resolve(sorted); p.lean = async () => sorted; return p; } };
};
PartnerProgram.findOne = async () => ({ freeTrialEnabled: true, freeServiceCount: 3, applyTo: 'all' });
Setting.findOne = async () => null;
Provider.findById = () => ({ populate: async () => provider });

const preview = () => new Promise((resolve, reject) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve(b); } };
    getProviderCommissionPreview({ params: { id: String(PID) }, query: { bookingAmount: 1000 } }, res).catch(reject);
});
const partner = (over = {}) => ({
    _id: PID, providerCategory: 'partner', vendorType: electrician, commissionRate: 10,
    freeTrial: { usedServices: 3, extraFreeServices: 0 }, ...over
});

(async () => {
    await check('the category slab is the effective rate, not the stored 10', async () => {
        slabs = [{ category: CAT, minAmount: 0, maxAmount: 999999, commissionRate: 8, providerCategory: 'all' }];
        provider = partner();
        const p = await preview();
        assert.strictEqual(p.appliedSource, 'CATEGORY_SLAB');
        assert.strictEqual(p.currentCommissionPercentage, 8);
        assert.strictEqual(p.categoryCommission.categoryName, 'Electrician');
        assert.strictEqual(p.categoryCommission.slabSource, 'CATEGORY_SLAB');
        assert.deepStrictEqual(p.categoryCommission.slabs.map(s => s.commissionRate), [8]);
    });

    await check('during the free trial the effective rate is 0, and the slab rate is still reported', async () => {
        provider = partner({ freeTrial: { usedServices: 0, extraFreeServices: 0 } });
        const p = await preview();
        assert.strictEqual(p.appliedSource, 'FREE_TRIAL');
        assert.strictEqual(p.currentCommissionPercentage, 0);
        assert.strictEqual(p.categoryCommission.categoryRate, 8);
    });

    await check('a category with no slab says so and reports the default it falls back to', async () => {
        slabs = [];
        provider = partner();
        const p = await preview();
        assert.strictEqual(p.categoryCommission.slabSource, 'GLOBAL_DEFAULT');
        assert.deepStrictEqual(p.categoryCommission.slabs, []);
        assert.strictEqual(p.appliedSource, 'GLOBAL_DEFAULT');
    });

    await check('admin and partner screens read the preview, not Provider.commissionRate', async () => {
        const admin = read('frontend', 'src', 'modules', 'admin', 'pages', 'AdminProviders.jsx');
        const profile = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderProfile.jsx');
        assert.ok(/\/v2\/admin\/providers\/\$\{selectedProvider\._id\}\/commission-preview/.test(admin));
        assert.ok(!/selectedProvider\.commissionRate/.test(admin));
        assert.ok(/\/v2\/provider\/commission-preview/.test(profile));
        assert.ok(!/user\?\.commissionRate \|\| 10/.test(profile));
    });

    console.log(`\n${passed} commission display checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
