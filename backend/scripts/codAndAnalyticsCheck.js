/**
 * Guards the two rules that were previously violated:
 *
 *   1. A cash-on-delivery booking is credited to the partner exactly ONCE,
 *      at completion. No collection route may credit the wallet again.
 *   2. Platform revenue reporting nets off the coin discounts the platform
 *      funded, so the loyalty programme's cost is visible.
 *
 *   node scripts/codAndAnalyticsCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const EarningsAnalyticsService = require('../services/EarningsAnalyticsService');
const CashSettlementService = require('../services/CashSettlementService');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

console.log('\nCash collection moves no money');
check('CashSettlementService never touches a wallet', () => {
    const src = read('services/CashSettlementService.js');
    assert.ok(!/availableBalance\s*[+\-]?=/.test(src), 'must not adjust availableBalance');
    assert.ok(!/wallet\.balance\s*[+\-]?=/.test(src), 'must not adjust balance');
});

check('no collection route credits availableBalance any more', () => {
    for (const file of ['controllers/bookingController.js', 'controllers/commissionController.js']) {
        const src = read(file);
        assert.ok(
            !/availableBalance\s*\+=\s*booking\.providerPayout/.test(src),
            `${file} still credits the payout at collection time`
        );
    }
});

check('all three collection routes go through the shared service', () => {
    const booking = read('controllers/bookingController.js');
    const commission = read('controllers/commissionController.js');
    // The provider status route and the collect-payment endpoint.
    assert.strictEqual(
        (booking.match(/CashSettlementService\.recordCollection/g) || []).length, 2,
        'bookingController should record both collection routes through the service'
    );
    // The admin COD settlement.
    assert.ok(/CashSettlementService\.recordCollection/.test(commission));
});

console.log('\nShared collectability rules');
const baseBooking = () => ({
    _id: 'b1', paymentMode: 'after', status: 'completed',
    paymentStatus: 'pending', collectionStatus: 'not_collected', totalAmount: 1000
});

check('a collectable cash booking passes', () => {
    assert.strictEqual(CashSettlementService.checkCollectable(baseBooking()), null);
});
check('a missing booking is a 404', () => {
    assert.strictEqual(CashSettlementService.checkCollectable(null).status, 404);
});
check('an online booking is refused', () => {
    const b = { ...baseBooking(), paymentMode: 'now' };
    assert.match(CashSettlementService.checkCollectable(b).message, /cash on delivery/i);
});
check('an incomplete booking is refused', () => {
    const b = { ...baseBooking(), status: 'started' };
    assert.match(CashSettlementService.checkCollectable(b).message, /completed/i);
});
check('an already-collected booking is refused (by either flag)', () => {
    assert.match(
        CashSettlementService.checkCollectable({ ...baseBooking(), paymentStatus: 'paid' }).message,
        /already been collected/i
    );
    assert.match(
        CashSettlementService.checkCollectable({ ...baseBooking(), collectionStatus: 'cash_collected' }).message,
        /already been collected/i
    );
});

console.log('\nRevenue reporting nets off the coin subsidy');
const bookings = [
    // Commission 120 against a 240 discount — a loss-making booking.
    { totalAmount: 960, adminCommission: 120, providerPayout: 1080, coinDiscount: 240,
      commissionSnapshot: { coinSubsidy: 240 }, travelCharge: { amount: 0 }, createdAt: new Date(), paymentStatus: 'paid' },
    // A plain booking with no coins involved.
    { totalAmount: 1000, adminCommission: 100, providerPayout: 900, coinDiscount: 0,
      commissionSnapshot: { coinSubsidy: 0 }, travelCharge: { amount: 0 }, createdAt: new Date(), paymentStatus: 'paid' }
];

const stats = EarningsAnalyticsService.getOverviewStats(
    bookings, [], [], [], new Date(Date.now() - 86400000), new Date(),
    new Date(Date.now() - 172800000), new Date(Date.now() - 86400000), 'day'
);

check('companyRevenue stays the gross commission earned', () => {
    assert.strictEqual(stats.companyRevenue.value, 220); // 120 + 100
});
check('coinSubsidy reports what the platform funded', () => {
    assert.strictEqual(stats.coinSubsidy.value, 240);
});
check('netRevenue is commission minus the subsidy', () => {
    assert.strictEqual(stats.netRevenue.value, -20); // 220 - 240
});
check('netRevenue can go negative and is reported as such', () => {
    assert.ok(stats.netRevenue.value < 0);
});
check('partner payouts are unaffected by the subsidy', () => {
    assert.strictEqual(stats.partnerPayout.value, 1980); // 1080 + 900
});
check('every KPI exposes a sparkline', () => {
    for (const key of ['companyRevenue', 'coinSubsidy', 'netRevenue', 'partnerPayout']) {
        assert.ok(Array.isArray(stats[key].sparkline), `${key} sparkline missing`);
    }
});

console.log('\nOlder rows without a snapshot still report correctly');
check('falls back to booking.coinDiscount when no snapshot exists', () => {
    const legacy = [{
        totalAmount: 900, adminCommission: 100, providerPayout: 0, coinDiscount: 100,
        travelCharge: { amount: 0 }, createdAt: new Date(), paymentStatus: 'paid'
    }];
    const s = EarningsAnalyticsService.getOverviewStats(
        legacy, [], [], [], new Date(Date.now() - 86400000), new Date(),
        new Date(Date.now() - 172800000), new Date(Date.now() - 86400000), 'day'
    );
    assert.strictEqual(s.coinSubsidy.value, 100);
    assert.strictEqual(s.netRevenue.value, 0); // 100 commission - 100 subsidy
    // Payout fallback adds the subsidy back: 900 + 100 - 100.
    assert.strictEqual(s.partnerPayout.value, 900);
});

console.log(`\n${passed} checks passed.\n`);
