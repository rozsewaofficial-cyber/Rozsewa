/**
 * Partner registration separates Individual and Business.
 *
 * Both account types saw the same nine "how do you work" cards, the card
 * chosen never narrowed the categories, an individual had to invent a
 * business name, and the Individual/Business choice was never saved.
 *
 *   node scripts/partnerAccountTypeCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Provider = require('../models/Provider');
const { registerProvider } = require('../controllers/providerController');
const { PARTNER_MODELS, isModelFor, cleanModelIds } = require('../config/partnerModels');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

// Everything registration reads besides the new partner is stubbed out.
require('../models/User').findOne = async () => null;
require('../models/Setting').findOne = async () => null;
require('../models/User').find = () => ({ select: () => ({ lean: async () => [] }), lean: async () => [] });

let created = null;
Provider.findOne = async () => null;
Provider.create = async (doc) => { created = doc; return { ...doc, _id: 'p1', status: 'pending' }; };

const register = (body) => new Promise((resolve) => {
    created = null;
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    registerProvider({ body: { mobile: '7000000001', ownerName: 'Ramesh Yadav', password: 'abcdef', address: 'a', city: 'b', state: 'c', ...body } }, res);
});

(async () => {
    await check('Retail & Shops and Hospitality are Business-only; the rest are for both', async () => {
        assert.deepStrictEqual(PARTNER_MODELS.shop, ['business']);
        assert.deepStrictEqual(PARTNER_MODELS.hotel, ['business']);
        assert.ok(isModelFor('taxi', 'individual') && isModelFor('taxi', 'business'));
        assert.ok(!isModelFor('hotel', 'individual'));
    });

    await check('an Individual is saved with their own name as the display name and no GST', async () => {
        await register({ accountType: 'individual', businessType: 'taxi', shopName: '', gst: '22AAAAA0000A1Z5' });
        assert.strictEqual(created.accountType, 'individual');
        assert.strictEqual(created.shopName, 'Ramesh Yadav');
        assert.strictEqual(created.gst, undefined);
    });

    await check('a Business keeps its business name', async () => {
        await register({ accountType: 'business', businessType: 'hotel', shopName: 'Shanti Lodge' });
        assert.strictEqual(created.accountType, 'business');
        assert.strictEqual(created.shopName, 'Shanti Lodge');
    });

    await check('an Individual cannot pick a Business-only card', async () => {
        const r = await register({ accountType: 'individual', businessType: 'hotel' });
        assert.strictEqual(r.code, 400);
        assert.strictEqual(created, null);
    });

    await check('a Business must give a business name', async () => {
        const r = await register({ accountType: 'business', businessType: 'shop', shopName: ' ' });
        assert.strictEqual(r.code, 400);
    });

    await check('an older app sending `type`, or nothing, still registers', async () => {
        await register({ type: 'business', businessType: 'shop', shopName: 'Old Build Shop' });
        assert.strictEqual(created.accountType, 'business');
        await register({ businessType: 'shop', shopName: 'Older Build Shop' });
        assert.strictEqual(created.accountType, undefined);
        assert.strictEqual(created.shopName, 'Older Build Shop');
    });

    await check('admin category tags keep only known cards, once each', async () => {
        assert.deepStrictEqual(cleanModelIds(['taxi', 'nope', 'taxi', 'hotel']), ['taxi', 'hotel']);
        assert.deepStrictEqual(cleanModelIds(undefined), []);
    });

    await check('the registration page shows each type its own cards and filters categories by card', async () => {
        const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderRegister.jsx');
        const data = read('frontend', 'src', 'modules', 'provider', 'data', 'partnerModels.js');
        assert.ok(/partnerModelsFor\(formData\.type\)\.map/.test(page));
        assert.ok(/categories\.filter\(c => categoryFitsModel\(c, formData\.businessType\)\)/.test(page));
        assert.ok(/API\.get\("\/provider\/categories\?providerType=partner"\)/.test(page), 'the partner category endpoint reads providerType');
        assert.ok(/accountType: formDataRef\.current\.type/.test(page));
        assert.ok(/\{isBusiness && \(\s*<div className="space-y-1\.5 md:col-span-2">\s*<label[^>]*>Business Name/.test(page));
        // Every card id on the page is one the server accepts.
        const ids = [...data.matchAll(/id: "([a-z_]+)",\s*icon:/g)].map(m => m[1]);
        assert.deepStrictEqual(ids.sort(), Object.keys(PARTNER_MODELS).sort());
    });

    console.log(`\n${passed} partner account-type checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
