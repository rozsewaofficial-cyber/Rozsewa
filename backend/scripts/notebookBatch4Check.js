/**
 * Notebook points 6-10 (partner app): commission card, why leads are not
 * arriving, extra personal items, and a discount on a service.
 *
 *   node scripts/notebookBatch4Check.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

(async () => {
    // ---- 7/8. lead readiness ---------------------------------------------
    const { Wallet } = require('../models/Wallet');
    const Setting = require('../models/Setting');
    let wallet = null;
    Wallet.findOne = () => ({ select: () => ({ lean: async () => wallet }) });
    Setting.findOne = async () => null; // default minimum balance: 200
    const { leadReadinessOf } = require('../controllers/leadController');
    const ok = () => ({
        providerCategory: 'partner', status: 'verified', isOnline: true, canReceiveLead: true,
        location: { coordinates: [75.85, 22.71] }, vendorType: { businessModel: 'lead' }, freeTrial: { usedServices: 0 }
    });
    const codes = async (p) => (await leadReadinessOf(p)).map(x => x.code);

    await check('a partner who is set up has nothing to fix', async () => {
        assert.deepStrictEqual(await codes(ok()), []);
    });
    await check('each reason a partner never hears of a lead is named', async () => {
        assert.deepStrictEqual(await codes({ ...ok(), status: 'pending' }), ['not_verified']);
        assert.deepStrictEqual(await codes({ ...ok(), isOnline: false }), ['offline']);
        assert.deepStrictEqual(await codes({ ...ok(), canReceiveLead: false }), ['leads_off']);
        assert.deepStrictEqual(await codes({ ...ok(), location: { coordinates: [0, 0] } }), ['no_location']);
    });
    await check('wallet balance only matters once the free leads are used', async () => {
        wallet = { balance: 0, availableBalance: 0 };
        assert.deepStrictEqual(await codes(ok()), [], 'still has free leads');
        assert.deepStrictEqual(await codes({ ...ok(), freeTrial: { usedServices: 3 } }), ['low_balance']);
        wallet = { balance: 500, availableBalance: 0 };
        assert.deepStrictEqual(await codes({ ...ok(), freeTrial: { usedServices: 3 } }), []);
    });
    await check('Sewaks and non-lead categories are told it is not for them, not shown as a fault', async () => {
        assert.deepStrictEqual(await codes({ ...ok(), providerCategory: 'sewak' }), ['sewak']);
        assert.ok((await codes({ ...ok(), vendorType: { businessModel: 'commission' } })).includes('not_lead_category'));
        const banner = read('frontend', 'src', 'modules', 'provider', 'components', 'LeadReadinessBanner.jsx');
        assert.ok(banner.includes('new Set(["sewak", "not_lead_category"])'));
        assert.ok(read('backend', 'routes', 'leadRoutes.js').includes("router.get('/readiness'"));
    });
    await check('the banner is on the partner home and the leads page', async () => {
        assert.ok(read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx').includes('<LeadReadinessBanner />'));
        assert.ok(read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderLeads.jsx').includes('<LeadReadinessBanner />'));
    });

    // ---- 9. extra personal item ------------------------------------------
    await check('Add Extra Service lets the partner type their own item', async () => {
        const list = read('frontend', 'src', 'modules', 'provider', 'components', 'RecentBookingsList.jsx');
        assert.ok(list.includes('value="__other__"') && list.includes('data-extra-custom'));
        assert.ok(list.includes('Item or service name'));
    });

    // ---- 10. discount on a service ---------------------------------------
    await check('a service keeps the price customers pay, plus the price before the discount', async () => {
        const Service = require('../models/Service');
        assert.ok(Service.schema.path('originalPrice') && Service.schema.path('discountPercent'));
        const ctl = read('backend', 'controllers', 'serviceController.js');
        assert.ok(ctl.includes('Math.round(original * (100 - discount) / 100)'));
        assert.ok(ctl.includes("'Discount must be between 0% and 90%.'"));
        assert.ok(/providerCategory === 'sewak'\s*\? 0/.test(ctl) || ctl.includes("provider?.providerCategory === 'sewak' ? 0"), 'a Sewak gets no discount');
    });
    await check('the partner form has a Discount field with a live preview, and the shop shows the saving', async () => {
        const form = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderServices.jsx');
        assert.ok(form.includes('data-discount-field') && form.includes('data-discount-preview'));
        assert.ok(form.includes('price: s.originalPrice || s.price'));
        const shop = read('frontend', 'src', 'modules', 'user', 'pages', 'ShopDetail.jsx');
        assert.ok(shop.includes('data-original-price') && shop.includes('% OFF'));
    });

    // ---- 6. commission card ---------------------------------------------
    await check('the commission card shows what the partner keeps, free-job progress and a readable range', async () => {
        const card = read('frontend', 'src', 'modules', 'provider', 'components', 'CommissionOverviewCard.jsx');
        assert.ok(card.includes('data-commission-example') && card.includes('data-free-jobs-progress'));
        assert.ok(card.includes('prettyRange'));
    });

    console.log(`\n${passed} notebook batch 4 checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
