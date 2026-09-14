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
    assert.ok(/params: \{ page, limit: itemsPerPage/.test(ui), 'the page must be requested');
    // Pinned as a contract, not as one dependency array: every table here has a
    // page number, and turning it has to become a request.
    ['commissionPage', 'settlementPage', 'withdrawalPage'].forEach(p => {
        assert.ok(new RegExp(`\\}, \\[[^\\]]*\\b${p}\\b[^\\]]*\\]\\)`).test(ui),
            `turning the ${p} must refetch`);
    });
    ['queue', 'settlements', 'withdrawals'].forEach(list => {
        assert.ok(!new RegExp(`\\b${list}\\.slice\\(`).test(ui),
            `no client-side slicing of ${list} may remain`);
    });
});

check('the Insta side keeps the same finished-job definition', () => {
    // Two different ideas of "finished" would make the settlement queue and the
    // earnings adapter disagree about the same job.
    const Adapter = require('../services/InstaEarningsAdapter');
    assert.deepStrictEqual(SettlementQueue.INSTA_DONE, Adapter.DONE_STATUSES);
});


console.log('\nThe earnings dashboard does not haul the whole ledger into memory');
const earnSrc = () => read('controllers/commissionController.js');

check('the figures come from a rollup, not from a list of bookings', () => {
    // This went in two steps. First the rows were made lean and projected: at
    // 20,000 bookings the hydrated form cost 371 MB and six seconds, the same
    // rows lean cost 14 MB for identical numbers. That still grew with the
    // data, so the sums moved into the database — a year of bookings now costs
    // the API nothing to total, because none of them travel.
    const src = earnSrc();
    assert.ok(/Rollup\.fromDatabase\(/.test(src), 'the period must be rolled up by the database');
    assert.ok(!/let currentBookings = await Booking\.find/.test(src),
        'the whole window must not be loaded into memory');
    assert.ok(!/let prevBookings = await Booking\.find/.test(src),
        'nor the comparison window');

    // The ledger is the one part that needs rows, and it only shows a page.
    assert.ok(/ledgerBookings[\s\S]{0,400}\.limit\(LEDGER_ROWS\)/.test(src),
        'the ledger rows must be bounded');
    assert.ok(/\.lean\(\)/.test(src), 'and lean');
});

check('the two ways of filling the buckets stay in step', () => {
    // One of them folds rows in memory, the other groups them in the database.
    // If they drift, the dashboard reports different money depending on which
    // path produced it — so both live in one file and are checked against each
    // other in scripts/earningsRollupCheck.js.
    const rollup = read('services/EarningsRollupService.js');
    assert.ok(/const foldRows =/.test(rollup) && /const fromDatabase =/.test(rollup),
        'both paths belong in the same file');
    assert.ok(fs.existsSync(path.join(__dirname, 'earningsRollupCheck.js')),
        'and the check that holds them together must exist');
});

check('only the fields the analytics read are fetched', () => {
    const src = earnSrc();
    assert.ok(/EARNINGS_FIELDS/.test(src), 'the projection must be named and shared');
    // Populating whole provider and customer documents on every row was most of
    // the weight.
    assert.ok(!/\.populate\('providerId'\)\s*$/m.test(src), 'no unprojected provider populate');
    assert.ok(!/\.populate\('userId'\)\s*$/m.test(src), 'no unprojected customer populate');
    assert.ok(/EARNINGS_PROVIDER_FIELDS/.test(src) && /EARNINGS_CUSTOMER_FIELDS/.test(src),
        'both joins must be projected');
});

check('the projection covers every field the analytics actually read', () => {
    // A field dropped from the projection would read as undefined and quietly
    // zero a figure, so the two lists are compared rather than trusted.
    const src = earnSrc();
    const projection = (src.match(/const EARNINGS_FIELDS =[\s\S]*?;/) || [''])[0];

    // Only the places that actually read a booking: the fold, and the ledger
    // rows. Scanning whole files picked up `b` as a sort comparator's second
    // argument and demanded a projection for `b.category`.
    const rollup = read('services/EarningsRollupService.js');
    const analytics = read('services/EarningsAnalyticsService.js');
    const foldBody = rollup.slice(rollup.indexOf('const foldRows ='), rollup.indexOf('/* ---', rollup.indexOf('const foldRows =')));
    const ledgerBody = analytics.slice(
        analytics.indexOf('static getRecentTransactions('),
        analytics.indexOf('currentWithdrawals.forEach')
    );

    const used = new Set(
        [...foldBody.matchAll(/\bb\.([a-zA-Z]+)/g), ...ledgerBody.matchAll(/\bb\.([a-zA-Z]+)/g)]
            .map(m => m[1])
    );
    // Fields the analytics compute for themselves rather than read from a row.
    ['rawDate', 'revenue'].forEach(k => used.delete(k));

    assert.ok(used.size > 5, 'the scan must actually find the fields being read');
    used.forEach(field => {
        assert.ok(projection.includes(field), `the projection is missing ${field}`);
    });
});

check('the adapter joins only the provider fields the reports use', () => {
    const adapter = read('services/InstaEarningsAdapter.js');
    assert.ok(!/\.populate\('providerId'\)\.lean\(\)/.test(adapter),
        'the Insta side must not populate the whole provider either');
    assert.ok(/shopName ownerName profileImage city/.test(adapter),
        'it needs the city for the filter and the name for top partners');
});

console.log('\nThe response carries a table, not the whole ledger');
check('the ledger sent is capped', () => {
    const src = earnSrc();
    assert.ok(/const LEDGER_ROWS = \d+;/.test(src), 'there must be a cap');
    assert.ok(/transactions\.slice\(0, LEDGER_ROWS\)/.test(src), 'and it must be applied');
    assert.ok(/transactionsTotal/.test(src), 'the real total must still be reported');
});

check('narrowing the response does not narrow the filter dropdowns', () => {
    // The screen's category, partner and city options used to be read off the
    // ledger rows, so they had to be taken before the ledger was cut down.
    // They come from the rollup now — which knows every category and partner in
    // the period regardless of how few rows are shipped — so the ordering the
    // old version depended on cannot go wrong any more.
    const src = earnSrc();
    assert.ok(/filterOptionsFromRollup\(/.test(src),
        'the options must come from the rollup, not from the rows on screen');
    assert.ok(!/getFilterOptions\(transactions/.test(src),
        'and not from the ledger the response was cut down to');

    const analytics = read('services/EarningsAnalyticsService.js');
    const body = analytics.slice(analytics.indexOf('static async filterOptionsFromRollup('));
    assert.ok(/rollup\.byCategory/.test(body) && /rollup\.byPartner/.test(body),
        'they are taken from the buckets, which cover the whole period');

    const ui = frontend('modules', 'admin', 'pages', 'AdminEarnings.jsx');
    assert.ok(/analyticsData\.filterOptions/.test(ui), 'the screen must use them');
    assert.ok(/const categoriesSet = new Set\(\)/.test(ui),
        'and still fall back for an older response');
});

check('the options are built from the same rules the screen used', () => {
    const S = require('../services/EarningsAnalyticsService');
    const txns = [
        { category: 'Cleaning', partner: { id: 'p1', name: 'Alpha' }, city: 'Indore' },
        { category: 'Settlement', partner: { id: 'N/A', name: 'N/A' }, city: 'Indore' },
        { category: 'Plumbing', partner: { id: 'p1', name: 'Alpha' }, city: 'Bhopal' }
    ];
    const opts = S.getFilterOptions(txns, []);
    // Settlements are not a service category, and an unknown partner is not one.
    assert.deepStrictEqual(opts.categories.sort(), ['Cleaning', 'Plumbing']);
    assert.strictEqual(opts.partners.length, 1);
    assert.deepStrictEqual(opts.cities.sort(), ['Bhopal', 'Indore']);
});

check('a period of nothing but settlements still offers categories', () => {
    const S = require('../services/EarningsAnalyticsService');
    const opts = S.getFilterOptions([{ category: 'Settlement' }], [{ category: 'Cleaning' }]);
    assert.deepStrictEqual(opts.categories, ['Cleaning']);
});


console.log('\nNo list endpoint can return an unbounded number of rows');
const { pageParams, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/pagination');

check('a caller who says nothing gets a page, not everything', () => {
    const p = pageParams({ query: {} });
    assert.strictEqual(p.limit, DEFAULT_LIMIT);
    assert.strictEqual(p.page, 1);
    assert.strictEqual(p.skip, 0);
});

check('a caller cannot ask for everything by another name', () => {
    assert.strictEqual(pageParams({ query: { limit: '999999' } }).limit, MAX_LIMIT);
    assert.strictEqual(pageParams({ query: { limit: '-5' } }).limit, DEFAULT_LIMIT);
    // A typo in a query string must not become a full table scan.
    assert.strictEqual(pageParams({ query: { limit: 'all' } }).limit, DEFAULT_LIMIT);
    assert.strictEqual(pageParams({ query: { page: 'first' } }).page, 1);
});

check('pages do not overlap', () => {
    const a = pageParams({ query: { page: '1', limit: '10' } });
    const b = pageParams({ query: { page: '2', limit: '10' } });
    assert.strictEqual(a.skip, 0);
    assert.strictEqual(b.skip, 10);
});

check('every list that used to return a whole collection is paged', () => {
    // Each of these read a collection that grows for the life of the platform
    // and returned all of it.
    const paged = [
        ['controllers/adminController.js', 3],       // bookings, reported bookings, feedback
        ['controllers/withdrawalController.js', 2],  // all withdrawals, a partner's own
        ['controllers/walletController.js', 1],      // wallet statement
        ['controllers/bookingController.js', 4],     // customer history, assigned, two review lists
        ['controllers/leadController.js', 1],        // disputes
        ['controllers/bazaarController.js', 1]       // unlock transactions
    ];
    paged.forEach(([file, count]) => {
        const src = read(file);
        const uses = (src.match(/paginate\(/g) || []).length;
        assert.ok(uses >= count, `${file} pages ${uses} lists, expected at least ${count}`);
    });
});

console.log('\nTotals are counted, not collected');
check('a rating average does not read every review', () => {
    // It recalculated by loading the provider's entire review history, on every
    // single review submitted.
    const src = read('controllers/bookingController.js');
    assert.ok(!/const allReviews = await Booking\.find/.test(src), 'no full review load may remain');
    assert.ok(/\$group: \{ _id: null, total: \{ \$sum: 1 \}, sum: \{ \$sum: '\$rating' \} \}/.test(src),
        'the count and sum must come from the database');
});

check('settlement totals are grouped once, not filtered per wallet', () => {
    const src = read('controllers/commissionController.js');
    assert.ok(!/Transaction\.find\(\{ title: 'Debt Settlement'/.test(src),
        'every settlement transaction must no longer be loaded');
    assert.ok(/settlementTotals/.test(src), 'they must be grouped by provider');
});

check('lead revenue is summed in the database', () => {
    const src = read('controllers/leadController.js');
    assert.ok(!/LeadUnlockTransaction\.find\(\{ status: 'success' \}\)\.lean\(\)/.test(src),
        'every unlock must no longer be read back to add up');
    assert.ok(/LeadUnlockTransaction\.aggregate/.test(src), 'it must be aggregated');
});

check("a worker's dashboard reads the month it reports on", () => {
    // It reported today, this week and this month, and loaded the whole career
    // to do it. The lifetime figure is a count, so it needs no rows at all.
    const src = read('controllers/providerController.js');
    assert.ok(/createdAt: \{ \$gte: monthStart \}/.test(src), 'the window must be applied');
    assert.ok(/countDocuments/.test(src), 'the lifetime figure must be counted');
    assert.ok(/countProviderJobs/.test(src), 'including the Insta side');
});

check('the reminder cron looks at the days it reminds about', () => {
    // It read every confirmed booking on the platform each run, and a confirmed
    // booking that never completes stays in that set forever.
    const src = read('cron/bookingReminders.js');
    assert.ok(!/Booking\.find\(\{ status: 'confirmed' \}\)/.test(src), 'no unfiltered read may remain');
    assert.ok(/bookingDate: \{ \$in: \[dayStamp/.test(src), 'it must be pinned to today and tomorrow');
});


console.log('\nA figure describes the collection, not the page it came from');
check('the admin headline is computed server-side over the whole scope', () => {
    // Paging the list without this turned "revenue" into "revenue of the last
    // 200 bookings" — a wrong money figure with nothing on screen to say so.
    const api = read('controllers/adminController.js');
    assert.ok(/const getBookingStats = async/.test(api), 'there must be a totals endpoint');
    assert.ok(/\$group: \{ _id: '\$status', count: \{ \$sum: 1 \} \}/.test(api),
        'the per-status counts must be grouped in the database');

    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    assert.ok(/API\.get\("\/admin\/bookings\/stats"\)/.test(ui), 'the screen must fetch them');
    assert.ok(/if \(serverStats\) return serverStats;/.test(ui),
        'and prefer them over anything derived from the page');
    assert.ok(/if \(serverStats\?\.statusCounts\) return serverStats\.statusCounts;/.test(ui),
        'including the count on each filter tab');
});

check('the list and its totals are scoped identically', () => {
    // Two separately-built scopes would let a supervisor see a headline covering
    // bookings their own list does not contain.
    const api = read('controllers/adminController.js');
    assert.ok(/const adminBookingScope = async \(req/.test(api), 'the scope must be shared');
    const stats = api.slice(api.indexOf('const getBookingStats'), api.indexOf('const getBookings ='));
    assert.ok(/await adminBookingScope\(req\)/.test(stats), 'the totals must use it');
});

check('a status filter narrows the revenue instead of being overwritten', () => {
    // Spreading { status: 'completed' } over the scope replaced the caller's
    // filter, so filtering the table to cancelled still reported every completed
    // booking's revenue.
    const api = read('controllers/adminController.js');
    assert.ok(/scopedToOtherStatus/.test(api),
        'a scope already pinned to another status must yield no revenue');
});

check('a screen showing a page says how many rows there really are', () => {
    const api = read('controllers/adminController.js');
    assert.ok(/res\.set\('X-Total-Count'/.test(api), 'the list must report the true count');
    const bookings = read('controllers/bookingController.js');
    assert.ok(/res\.set\('X-Total-Count'/.test(bookings), "as must a customer's history");
});

check('that header is readable from the browser', () => {
    // A custom header on a cross-origin response is invisible to JavaScript
    // unless it is named, so the screen would silently fall back to the page
    // size and report it as the total.
    const server = read('index.js');
    const exposed = (server.match(/exposedHeaders:\s*\[([^\]]*)\]/) || [])[1] || '';
    assert.ok(exposed.includes('X-Total-Count'),
        'X-Total-Count must be exposed to the browser');
});

check('a wallet statement can be paged past the rows it was handed', () => {
    const api = read('controllers/walletController.js');
    assert.ok(/transactionsTotal: await Transaction\.countDocuments\(query\)/.test(api),
        'the true count must be sent');
    const ui = frontend('modules', 'provider', 'pages', 'ProviderWallet.jsx');
    assert.ok(/transactionsTotal \/ itemsPerPage/.test(ui),
        'the page count must come from it, not from the rows in hand');
    assert.ok(/\}, \[currentPage\]\)/.test(ui), 'turning a page must fetch that page');
});

check('the table pages the whole collection, so it needs no caveat', () => {
    // It briefly held the most recent rows and said so. Now that searching and
    // paging both happen server-side it reaches every row, and the apology that
    // stood in for that would be untrue.
    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    assert.ok(!/most recent \{\(bookings \|\| \[\]\)\.length\} of/.test(ui),
        'the caveat should be gone now that it no longer applies');
    assert.ok(/of \{matchingTotal\} bookings/.test(ui),
        'the pager counts every row that matched');
});


console.log('\nSearching reaches the collection, not the rows already sent');
check('the search runs in the query, not in the browser', () => {
    // Filtering in the browser could only ever find what had already been sent,
    // which on a paged list is the most recent page.
    const api = read('controllers/adminController.js');
    assert.ok(/adminBookingScope\(req, \{ includeSearch: true \}\)/.test(api),
        'the list must search server-side');

    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    assert.ok(/search: searchTerm/.test(ui), 'the screen must send the term');
    assert.ok(!/matchesSearch/.test(ui), 'no in-browser search may remain');
    assert.ok(!/filteredBookings\.slice\(startIndex/.test(ui), 'nor in-browser slicing');
});

check('it reaches the customer and the provider, not just the booking', () => {
    // Those live on other collections, so they are resolved to ids first.
    const api = read('controllers/adminController.js');
    assert.ok(/User\.find\(\{ \$or: \[\{ name: rx \}, \{ mobile: rx \}\] \}\)/.test(api),
        'a customer name or mobile must match');
    assert.ok(/Provider\.find\(\{ \$or: \[\{ shopName: rx \}, \{ ownerName: rx \}\] \}\)/.test(api),
        'as must a provider name');
});

check('a search term cannot be a regular expression', () => {
    // A term goes straight into a RegExp, so anything meaningful in one is
    // escaped first — otherwise a stray bracket is a 500 and a crafted term is
    // a way to make the database work very hard.
    const api = read('controllers/adminController.js');
    // Matched as plain text: writing this expectation as a regular expression
    // means escaping an escaping expression, which is how the check itself ends
    // up wrong rather than the code.
    assert.ok(api.includes('new RegExp(term.replace('),
        'the term must be escaped before becoming a pattern');
});

check('the figures above the table ignore the search', () => {
    // The cards describe the platform; the table answers what was typed. The
    // stats call deliberately carries neither the search nor the status.
    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    const statsCall = ui.slice(ui.indexOf('API.get("/admin/bookings/stats")') - 10,
        ui.indexOf('API.get("/admin/bookings/stats")') + 60);
    assert.ok(!/search|status/.test(statsCall), 'the totals must not be narrowed by the search');
});

check('the pager counts what matched, not what is on screen', () => {
    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    assert.ok(/Math\.ceil\(matchingTotal \/ itemsPerPage\)/.test(ui),
        'the page count must come from the match');
    assert.ok(/x-total-count/.test(ui), 'which the server reports');
});

check('typing does not fire a query per keystroke', () => {
    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    assert.ok(/setTimeout\(\(\) => fetchBookings\(\), searchTerm \? \d+ : 0\)/.test(ui),
        'the search must settle before it is sent');
});

check('exporting covers the match rather than the page on screen', () => {
    // The table holds ten rows now, so exporting it would quietly produce a file
    // of ten.
    const ui = frontend('modules', 'admin', 'pages', 'AdminBookings.jsx');
    assert.ok(/let exportRows = filteredBookings;/.test(ui), 'the export must fetch its own rows');
    assert.ok(/limit: 1000/.test(ui), 'across the whole match');
    assert.ok(/exportRows\.map\(b => \[/.test(ui), 'and build the file from those');
});

console.log(`\n${passed} checks passed.\n`);
