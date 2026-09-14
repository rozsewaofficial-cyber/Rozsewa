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
const frontend = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', ...p), 'utf8');

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


console.log('\nOne definition of what we sold');
const subsidised = {
    totalAmount: 160,                 // what the customer paid
    adminCommission: 20,              // charged on the full 200
    providerPayout: 180,              // paid on the full 200
    coinDiscount: 40,                 // funded by the platform
    status: 'completed',
    paymentStatus: 'paid',
    paymentMode: 'after',
    serviceName: 'Coin Funded Clean',
    createdAt: new Date()
};

check('gross is the value of the work, not the cash collected', () => {
    // A platform-funded discount does not make the job smaller: commission is
    // charged on the full value and the partner is paid from it.
    assert.strictEqual(EarningsAnalyticsService.grossValue(subsidised), 200);
    assert.strictEqual(EarningsAnalyticsService.platformSubsidy(subsidised), 40);
});

check('an undiscounted booking is unaffected', () => {
    assert.strictEqual(EarningsAnalyticsService.grossValue({ totalAmount: 225 }), 225);
    assert.strictEqual(EarningsAnalyticsService.platformSubsidy({ totalAmount: 225 }), 0);
});

check('the snapshot wins over the legacy field', () => {
    // The snapshot is written at completion and is the authority; the loose
    // field is only there for rows that predate it.
    const b = { totalAmount: 160, coinDiscount: 999, commissionSnapshot: { coinSubsidy: 40, offerSubsidy: 0 } };
    assert.strictEqual(EarningsAnalyticsService.grossValue(b), 200);
});

check('gross, revenue and payout reconcile on a subsidised booking', () => {
    // The invariant a reader applies without thinking: every rupee of gross is
    // either the platform's commission or the partner's payout. Defining gross
    // as the discounted price broke it — gross came out smaller than the sum it
    // had to cover.
    const now = new Date();
    const s = EarningsAnalyticsService.getOverviewStats(
        [subsidised], [], [], [], new Date(now - 86400000), now, new Date(now - 172800000), new Date(now - 86400000), 'day'
    );
    assert.strictEqual(s.grossSales.value, 200);
    assert.strictEqual(s.companyRevenue.value + s.partnerPayout.value, s.grossSales.value);
    assert.strictEqual(s.netRevenue.value, s.companyRevenue.value - s.coinSubsidy.value);
});

check('the category table adds up to the gross headline', () => {
    // Two screens disagreeing about the same period is how finance stops
    // trusting the dashboard.
    const rows = EarningsAnalyticsService.getCategoryBreakdown([subsidised, { totalAmount: 225, adminCommission: 22.5, serviceName: 'Plain' }]);
    const total = rows.reduce((sum, r) => sum + r.revenue, 0);
    assert.strictEqual(total, 200 + 225);
});

check('the aggregation expression matches the in-memory helper', () => {
    // The database path and the in-memory path must not drift into two
    // different answers.
    const expr = EarningsAnalyticsService.grossAggregationExpr();
    const fields = JSON.stringify(expr);
    assert.ok(fields.includes('$totalAmount'), 'must start from totalAmount');
    assert.ok(fields.includes('$commissionSnapshot.coinSubsidy'), 'must prefer the snapshot');
    assert.ok(fields.includes('$coinDiscount'), 'must fall back to the legacy field');
    assert.ok(fields.includes('$commissionSnapshot.offerSubsidy'), 'offers are funded the same way');
});

check('both admin dashboards use that expression', () => {
    // The headline on /admin and the GMV on /admin/earnings describe the same
    // period; they must not print different numbers.
    const admin = read('controllers/adminController.js');
    assert.ok(!/\$sum: "\$totalAmount"/.test(admin), 'a dashboard still totals the discounted price');
    const uses = (admin.match(/grossAggregationExpr\(\)/g) || []).length;
    assert.strictEqual(uses, 2, 'both the platform and supervisor dashboards must use it');
});


console.log('\nThe settlement queue is computed in the database, not in memory');
const SettlementQueue = require('../services/SettlementQueueService');
const queueSrc = () => read('services/SettlementQueueService.js');

check('nothing loads every completed row to render one screen', () => {
    // This page used to pull every completed booking and every completed Insta
    // job into the process — populated — for four numbers and one screenful.
    const controller = read('controllers/commissionController.js');
    assert.ok(!/Booking\.find\(\{ status: 'completed' \}\)/.test(controller),
        'the controller must not load every completed booking');
    assert.ok(!/getProviderJobs\(null/.test(controller),
        'nor every completed Insta job');
    assert.ok(/SettlementQueue\.getTotals\(\)/.test(controller), 'totals must be aggregated');
    assert.ok(/SettlementQueue\.getPage\(/.test(controller), 'rows must be paged');
});

check('both collections are merged into one ordered list', () => {
    // Paging each collection separately and stitching the halves gives a
    // different set of rows per page depending on how the dates interleave.
    const src = queueSrc();
    assert.ok(/\$unionWith/.test(src), 'the two collections must be merged in one pipeline');
    assert.ok(/\$sort: \{ createdAt: -1, _id: -1 \}/.test(src), 'and sorted as a single list');
    assert.ok(/\$skip/.test(src) && /\$limit/.test(src), 'and paged in the database');
});

check('only the rows on the page are joined to their provider', () => {
    const src = queueSrc();
    const lookupAt = src.indexOf('$lookup');
    const limitAt = src.indexOf('$limit');
    assert.ok(lookupAt > limitAt && limitAt > 0,
        'the provider join must come after the page is cut, not before');
});

check('a caller cannot ask for an unbounded page', () => {
    const src = queueSrc();
    assert.ok(/Math\.min\(Math\.max\(1, Number\(limit\) \|\| \d+\), \d+\)/.test(src),
        'the page size must be clamped');
});

check('a row reports the value of the work, subsidy included', () => {
    // Otherwise a platform-funded discount leaves a row whose commission and
    // payout do not add up to its own job value.
    assert.ok(/grossAggregationExpr\(\)/.test(queueSrc()),
        'the queue must use the shared gross definition');
});

check('a legacy row with no stored payout still settles', () => {
    // Reporting zero would understate what is owed to the partner.
    const src = queueSrc();
    assert.ok(/\$subtract: \['\$totalAmount', '\$adminCommission'\]/.test(src),
        'payout must be derived when it was never written');
});

check('the totals describe the queue, not the page being viewed', () => {
    // They would otherwise change as the admin pages, which reads as a bug.
    const controller = read('controllers/commissionController.js');
    assert.ok(/queueTotals: \{/.test(controller), 'whole-queue totals must be sent');
    assert.ok(/queueTotal: totals\.totalCompleted/.test(controller), 'as must the full count');
    const ui = frontend('modules', 'admin', 'pages', 'AdminCommission.jsx');
    assert.ok(/queueTotals\.jobV/.test(ui), 'the totals row must use them');
    assert.ok(!/queue\.reduce\(\(s, r\) => s \+ \(r\.jobV/.test(ui),
        'and must not re-sum the page it happens to hold');
});

check('the admin screen asks for a page instead of slicing everything', () => {
    const ui = frontend('modules', 'admin', 'pages', 'AdminCommission.jsx');
    assert.ok(/params: \{ page, limit: itemsPerPage \}/.test(ui), 'the page must be requested');
    assert.ok(/\}, \[commissionPage\]\)/.test(ui), 'turning a page must refetch');
    assert.ok(!/queue\.slice\(/.test(ui), 'no client-side slicing may remain');
});

check('the Insta side keeps the same finished-job definition', () => {
    // Two different ideas of "finished" would make the settlement queue and the
    // earnings adapter disagree about the same job.
    const Adapter = require('../services/InstaEarningsAdapter');
    assert.deepStrictEqual(SettlementQueue.INSTA_DONE, Adapter.DONE_STATUSES);
});

console.log(`\n${passed} checks passed.\n`);
