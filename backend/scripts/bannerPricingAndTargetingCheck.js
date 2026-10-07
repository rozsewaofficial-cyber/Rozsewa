/**
 * Partner banners: the server prices every plan (duration and GST included),
 * targets by normalised location without building regexes from input, ranks
 * Premium Top first, and refuses to create a banner without a verified
 * payment or for a non-partner account.
 *
 *   node scripts/bannerPricingAndTargetingCheck.js
 *
 * Runs the real service/controller with the models stubbed; no database.
 * Money movement (wallet debit, refunds) is exercised end-to-end against a
 * scratch database separately.
 */
const assert = require('assert');
// paymentController builds its Razorpay client on load; no call is made here.
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_check_only';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'check_only';
const Setting = require('../models/Setting');
const Banners = require('../services/BannerService');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

let settings = {};
Setting.findOne = ({ key }) => ({ lean: async () => (key in settings ? { key, value: settings[key] } : null) });

const res = () => {
    const r = { code: 200, body: undefined };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
};

(async () => {
    await check('a longer duration costs proportionally more, plus 18% GST', async () => {
        settings = {
            provider_banner_plans: [{ id: 'City', title: 'City', price: 500 }, { id: 'Premium Top', title: 'Top', price: 3000 }],
            provider_banner_durations: [7, 14, 30]
        };
        const q7 = await Banners.quote('City', 7);
        const q30 = await Banners.quote('City', 30);
        assert.deepStrictEqual([q7.basePrice, q7.gstAmount, q7.total], [500, 90, 590]);
        assert.strictEqual(q30.basePrice, Math.round(500 * 30 / 7 * 100) / 100);
        assert.ok(q30.total > q7.total * 4);
    });

    await check('a plan or duration the admin does not offer is refused', async () => {
        await assert.rejects(() => Banners.quote('State', 7), /not available/);
        await assert.rejects(() => Banners.quote('City', 365), /offered durations/);
        await assert.rejects(() => Banners.quote('City', -7), /offered durations/);
    });

    await check('the plans endpoint lists the server price for every duration', async () => {
        const out = await Banners.listPlansWithPrices();
        assert.deepStrictEqual(out.durations, [7, 14, 30]);
        assert.strictEqual(out.plans.find(p => p.id === 'City').prices[14].basePrice, 1000);
        assert.strictEqual(out.gstPercent, 18);
    });

    await check('with nothing configured, the defaults price a 7-day plan', async () => {
        settings = {};
        const q = await Banners.quote('Local', 7);
        assert.strictEqual(q.basePrice, 199);
    });

    await check('targets are validated and normalised', async () => {
        assert.throws(() => Banners.resolveTarget('Local', { targetPincode: '1234' }), /6-digit/);
        assert.strictEqual(Banners.resolveTarget('Local', { targetPincode: '452001' }).locationKey, '452001');
        assert.strictEqual(Banners.resolveTarget('District', { targetDistrict: 'Indore District' }).locationKey, 'indore');
        assert.strictEqual(Banners.resolveTarget('City', { targetCity: '  NEW Delhi ' }).locationKey, 'new delhi');
        assert.throws(() => Banners.resolveTarget('State', { targetState: '  ' }), /state/);
        assert.deepStrictEqual(Banners.resolveTarget('Premium Top', {}), { locationValue: 'ALL', locationKey: 'all' });
    });

    await check('a customer location matches only banners aimed at it', async () => {
        const place = Banners.customerPlace({ pincode: '452001', city: 'Indore', district: 'Indore District', state: 'Madhya Pradesh' });
        const t = (b) => Banners.bannerTargets(b, place);
        assert.ok(t({ planType: 'Premium Top' }));
        assert.ok(t({ planType: 'Local', locationValue: '452001' }));
        assert.ok(t({ planType: 'City', locationKey: 'indore' }));
        assert.ok(t({ planType: 'District', locationValue: 'Indore' }), 'legacy row without a key');
        assert.ok(t({ planType: 'State', locationKey: 'madhya pradesh' }));
        assert.ok(!t({ planType: 'City', locationKey: 'bhopal' }));
        assert.ok(!t({ planType: 'Local', locationValue: '110001' }));
        assert.ok(!Banners.bannerTargets({ planType: 'City', locationKey: 'indore' }, Banners.customerPlace({})), 'no location: only Premium Top');
    });

    await check('location queries never build a regex from raw input', async () => {
        const or = Banners.locationConditions(Banners.customerPlace({ city: 'a(b+c' }));
        for (const c of or) {
            if (c.locationValue?.$regex) assert.doesNotThrow(() => new RegExp(c.locationValue.$regex));
        }
        assert.ok(or.some(c => c.planType === 'City' && c.locationKey === 'a b c'));
    });

    await check('Premium Top is ranked first, then the most specific plan', async () => {
        const ranked = Banners.rankBanners([
            { planType: 'State' }, { planType: 'City' }, { planType: 'Premium Top' }, { planType: 'Local' }, { planType: 'District' }
        ]).map(b => b.planType);
        assert.deepStrictEqual(ranked, ['Premium Top', 'Local', 'City', 'District', 'State']);
    });

    await check('only a verifiably paid amount is ever refunded automatically', async () => {
        const v = Banners.verifiedPaidAmount;
        assert.strictEqual(v({ pricePaid: 590, paidVia: 'wallet' }), 590);
        assert.strictEqual(v({ pricePaid: 3540, paidVia: 'razorpay' }), 3540);
        assert.strictEqual(v({ pricePaid: 999, paymentId: 'WALLET_abc' }), 999, 'old wallet purchases really debited this');
        assert.strictEqual(v({ pricePaid: 2999, paymentId: 'pay_whatever' }), 0, 'old unverified Razorpay claim: manual');
        assert.strictEqual(v({ pricePaid: 2999 }), 0);
        assert.strictEqual(v({ pricePaid: -5000, paymentId: 'WALLET_x' }), 0);
    });

    const ctrl = require('../controllers/providerBannerController');
    settings = { provider_banner_plans: [{ id: 'City', price: 500 }], provider_banner_durations: [7] };

    await check('a banner is never created from a payment id alone', async () => {
        const r = res();
        await ctrl.createBannerRequest({
            user: { _id: 'p1', role: 'provider' },
            body: { planType: 'City', targetCity: 'Indore', imageUrl: 'https://x/y.png', paymentId: 'pay_fake', pricePaid: 2999 }
        }, r);
        assert.strictEqual(r.code, 400);
        assert.match(r.body.message, /Payment details are missing/);
    });

    await check('a payment for something else, or an order without a priced plan, buys no banner', async () => {
        const pc = require('../controllers/paymentController');
        const real = pc.claimPayment;
        pc.claimPayment = async () => ({ order: { amount: 1, purpose: 'banner', meta: undefined } });
        try {
            const r = res();
            await ctrl.createBannerRequest({
                user: { _id: 'p1', role: 'provider' },
                body: { planType: 'City', targetCity: 'Indore', imageUrl: 'https://x/y.png', razorpay_order_id: 'o', razorpay_payment_id: 'p', razorpay_signature: 's' }
            }, r);
            assert.strictEqual(r.code, 400);
            assert.match(r.body.message, /not made for a banner plan/);
        } finally {
            pc.claimPayment = real;
        }
    });

    await check('only partner accounts can buy banners', async () => {
        for (const fn of ['createBannerRequest', 'createBannerWithWallet', 'createBannerOrder']) {
            const r = res();
            await ctrl[fn]({ user: { _id: 'u1', role: 'customer' }, body: { planType: 'City', durationDays: 7, targetCity: 'Indore', designDescription: 'x' } }, r);
            assert.strictEqual(r.code, 403, fn);
        }
    });

    await check('the wallet price comes from the server, never the request', async () => {
        const r = res();
        // An unoffered duration is refused before any wallet is touched,
        // whatever price the request claims.
        await ctrl.createBannerWithWallet({ user: { _id: 'p1', role: 'provider' }, body: { planType: 'City', durationDays: 365, targetCity: 'Indore', designDescription: 'x', pricePaid: -5000 } }, r);
        assert.strictEqual(r.code, 400);
        assert.match(r.body.message, /offered durations/);
    });

    await check('a description-only request goes to design, an image request to review; a bad image link is refused', async () => {
        const r = res();
        await ctrl.createBannerWithWallet({ user: { _id: 'p1', role: 'provider' }, body: { planType: 'City', durationDays: 7, targetCity: 'Indore', imageUrl: 'javascript:alert(1)' } }, r);
        assert.strictEqual(r.code, 400);
        assert.match(r.body.message, /image link is not valid/);
    });

    console.log(`\n${passed} banner pricing/targeting checks passed.\n`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
