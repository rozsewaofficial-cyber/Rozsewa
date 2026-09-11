/**
 * Pins down the RozSewa Offer System rules that are easy to break later.
 *
 * No database — pure logic, safe to run anywhere:
 *
 *   node scripts/offerCheck.js
 */
const assert = require('assert');
const OfferService = require('../services/OfferService');
const CommissionService = require('../services/CommissionService');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

console.log('\nDiscount percent is auto-calculated from MRP');
check("the spec's own example: Rs 269 -> Rs 109 is 59% OFF", () => {
    assert.strictEqual(OfferService.computeDiscountPercent(269, 109), 59);
});
check('Rs 1000 -> Rs 500 is 50%', () => {
    assert.strictEqual(OfferService.computeDiscountPercent(1000, 500), 50);
});
check('a zero MRP yields 0 rather than dividing by zero', () => {
    assert.strictEqual(OfferService.computeDiscountPercent(0, 109), 0);
});
check('an offer above MRP never renders a negative discount', () => {
    assert.strictEqual(OfferService.computeDiscountPercent(100, 150), 0);
});
check('a free offer is 100%', () => {
    assert.strictEqual(OfferService.computeDiscountPercent(200, 0), 100);
});

console.log('\nLifecycle status derives from the switch and the date window');
const day = 24 * 60 * 60 * 1000;
const now = new Date();
check('inside the window and switched on = active', () => {
    assert.strictEqual(OfferService.deriveStatus({
        isActive: true, startDate: new Date(now - day), endDate: new Date(now.getTime() + day)
    }, now), 'active');
});
check('window not yet open = scheduled', () => {
    assert.strictEqual(OfferService.deriveStatus({
        isActive: true, startDate: new Date(now.getTime() + day), endDate: new Date(now.getTime() + 2 * day)
    }, now), 'scheduled');
});
check('window closed = expired', () => {
    assert.strictEqual(OfferService.deriveStatus({
        isActive: true, startDate: new Date(now - 2 * day), endDate: new Date(now - day)
    }, now), 'expired');
});
check('switched off wins over any date window', () => {
    assert.strictEqual(OfferService.deriveStatus({
        isActive: false, startDate: new Date(now - day), endDate: new Date(now.getTime() + day)
    }, now), 'inactive');
});

console.log('\nThe live filter is what protects a missed cron run');
check('liveFilter constrains isActive AND both date bounds', () => {
    const f = OfferService.liveFilter(now);
    assert.strictEqual(f.isActive, true);
    // Both bounds present means an expired row can never match, regardless of
    // whatever the stored `status` label happens to say.
    assert.ok(f.startDate.$lte instanceof Date);
    assert.ok(f.endDate.$gte instanceof Date);
});

console.log('\nOffer discounts are funded by the platform');
/** Mirrors verifyEndOTP with both subsidies folded together. */
const settle = ({ customerPaid, coinSubsidy = 0, offerSubsidy = 0, rate, paymentMode }) => {
    const platformSubsidy = coinSubsidy + offerSubsidy;
    const grossOrderAmount = customerPaid + platformSubsidy;
    const calc = CommissionService.calculate(grossOrderAmount, { rate, source: 'CATEGORY_SLAB' });
    const adminCommission = calc.platformAmount;
    const providerPayout = calc.providerAmount;
    const walletDelta = paymentMode === 'now'
        ? { availableBalance: providerPayout }
        : { balance: -(adminCommission - platformSubsidy) };
    return { grossOrderAmount, adminCommission, providerPayout, walletDelta, platformSubsidy };
};

check('a Rs 269 service sold at Rs 109 still pays the partner on Rs 269', () => {
    const withOffer = settle({ customerPaid: 109, offerSubsidy: 160, rate: 10, paymentMode: 'now' });
    const without = settle({ customerPaid: 269, rate: 10, paymentMode: 'now' });
    assert.strictEqual(withOffer.grossOrderAmount, 269);
    assert.strictEqual(withOffer.providerPayout, without.providerPayout);
});

check('commission is charged on MRP, not the offer price', () => {
    const { adminCommission } = settle({ customerPaid: 109, offerSubsidy: 160, rate: 10, paymentMode: 'now' });
    assert.strictEqual(adminCommission, 26.9); // 10% of 269
});

check('the platform is out of pocket by subsidy minus commission', () => {
    const { providerPayout, adminCommission, platformSubsidy } =
        settle({ customerPaid: 109, offerSubsidy: 160, rate: 10, paymentMode: 'now' });
    const platformNet = 109 - providerPayout;
    assert.strictEqual(Math.round(platformNet * 10) / 10, Math.round((adminCommission - platformSubsidy) * 10) / 10);
    assert.ok(platformNet < 0, 'a deep offer should cost the platform money');
});

check('cash settlement: the dues wallet moves by payout minus cash collected', () => {
    const { walletDelta, providerPayout } =
        settle({ customerPaid: 109, offerSubsidy: 160, rate: 10, paymentMode: 'after' });
    assert.strictEqual(
        Math.round(walletDelta.balance * 10) / 10,
        Math.round((providerPayout - 109) * 10) / 10
    );
    assert.ok(walletDelta.balance > 0, 'RozSewa owes the partner the difference');
});

console.log('\nOffers and coins stack into one platform subsidy');
check('an offer and coins on one booking combine', () => {
    // Rs 269 MRP, offer to Rs 109, then Rs 21 of coins on top.
    const { grossOrderAmount, platformSubsidy, providerPayout } =
        settle({ customerPaid: 88, coinSubsidy: 21, offerSubsidy: 160, rate: 10, paymentMode: 'now' });
    assert.strictEqual(platformSubsidy, 181);
    assert.strictEqual(grossOrderAmount, 269);
    // The partner is untouched by either discount.
    assert.strictEqual(providerPayout, settle({ customerPaid: 269, rate: 10, paymentMode: 'now' }).providerPayout);
});

check('no offer and no coins reduces to the plain commission debit', () => {
    const { walletDelta, adminCommission } =
        settle({ customerPaid: 1000, rate: 10, paymentMode: 'after' });
    assert.strictEqual(adminCommission, 100);
    assert.strictEqual(walletDelta.balance, -100);
});

console.log('\nThe customer card exposes only display fields');
check('toPublicCard carries the booking target but no internals', () => {
    const card = OfferService.toPublicCard({
        _id: 'o1', serviceName: 'Bathroom Cleaning', categoryName: 'Home Services',
        offerPrice: 109, originalPrice: 269, discountPercent: 59, image: null,
        endDate: new Date(), allowCoins: false,
        targetType: 'service', serviceId: 's1', categoryId: null, subServiceId: null,
        createdBy: 'admin1', status: 'active'
    });
    assert.strictEqual(card.offerPrice, 109);
    assert.strictEqual(card.originalPrice, 269);
    assert.strictEqual(card.discountPercent, 59);
    assert.strictEqual(card.allowCoins, false);
    // The id the checkout sends back, whichever catalog it came from.
    assert.strictEqual(card.target.itemId, 's1');
    // Internal bookkeeping must not leak to the customer app.
    assert.strictEqual(card.createdBy, undefined);
    assert.strictEqual(card.status, undefined);
});

check('a category_service card exposes the sub-service id as itemId', () => {
    const card = OfferService.toPublicCard({
        _id: 'o2', serviceName: 'Deep Clean', categoryName: 'Sewak',
        offerPrice: 99, originalPrice: 199, discountPercent: 50, image: null,
        endDate: new Date(), allowCoins: true,
        targetType: 'category_service', serviceId: null, categoryId: 'c1', subServiceId: 'sub1'
    });
    assert.strictEqual(card.target.itemId, 'sub1');
    assert.strictEqual(card.target.targetType, 'category_service');
});

console.log(`\n${passed} offer checks passed.\n`);
