/**
 * The earnings dashboard has two ways to reach the same numbers: folding rows
 * in memory, and grouping them in the database. They must not disagree.
 *
 * This runs both over the same generated bookings and compares every bucket.
 * No database needed for the folding side; the aggregation side is exercised
 * against a throwaway instance when one is supplied:
 *
 *   node scripts/earningsRollupCheck.js
 *   EARNINGS_TEST_URI=mongodb://127.0.0.1:27020/scratch node scripts/earningsRollupCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const S = require('../services/EarningsAnalyticsService');
const R = require('../services/EarningsRollupService');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

/* ------------------------------------------------------------------ */
/* The rule these buckets exist to serve                               */
/* ------------------------------------------------------------------ */

console.log('\nThe buckets the dashboard is drawn from');

const booking = (over = {}) => ({
    _id: '000000000000000000000001',
    totalAmount: 1000,
    adminCommission: 100,
    providerPayout: 900,
    createdAt: new Date('2026-03-15T10:00:00'),
    paymentMode: 'now',
    paymentStatus: 'paid',
    status: 'completed',
    serviceName: 'Plumbing',
    travelCharge: { amount: 0 },
    extraCharges: [],
    ...over
});

check('a platform-funded discount counts toward gross, not against it', () => {
    const r = R.foldRows([booking({
        totalAmount: 960,
        commissionSnapshot: { coinSubsidy: 40 }
    })]);
    // The job was worth 1000; the customer paid 960 and RozSewa funded 40.
    assert.strictEqual(r.totals.gross, 1000);
    assert.strictEqual(r.totals.coinSubsidy, 40);
    // Commission earned less what the discount cost.
    assert.strictEqual(r.totals.netRevenue, 60);
});

check('a cancelled booking is a refund, whatever it was paid with', () => {
    const r = R.foldRows([booking({ status: 'cancelled' })]);
    assert.strictEqual(r.totals.refunds, 1000);
});

check('payout falls back to gross less commission, not to the paid price', () => {
    const r = R.foldRows([booking({
        totalAmount: 960,
        providerPayout: 0,
        commissionSnapshot: { coinSubsidy: 40 }
    })]);
    // 1000 of work, 100 of commission — the discount is RozSewa's cost, not a
    // deduction from the partner.
    assert.strictEqual(r.totals.payout, 900);
});

check('an extra charge lands in the bucket its wording points at', () => {
    const r = R.foldRows([booking({
        extraCharges: [
            { item: 'Night Visit Charge', amount: 50 },
            { item: 'Holiday surcharge', amount: 30 },
            { item: 'Something else', amount: 20 }
        ]
    })]);
    // "Night Visit Charge" contains both words; visit is checked first, which
    // is the order the screen has always applied.
    assert.strictEqual(r.sources.visit, 50);
    assert.strictEqual(r.sources.holiday, 30);
    assert.strictEqual(r.sources.other, 20);
    assert.strictEqual(r.sources.service, 900);
});

check('the extras never add up to more than the job was worth', () => {
    const r = R.foldRows([booking({
        totalAmount: 100,
        extraCharges: [{ item: 'Urgent', amount: 500 }]
    })]);
    assert.strictEqual(r.sources.service, 0);
    // The overshoot moves to "other" rather than making service negative.
    assert.strictEqual(r.sources.other, -400);
});

check('two rollups add up', () => {
    const a = R.foldRows([booking()]);
    const b = R.foldRows([booking({ adminCommission: 50 })]);
    const m = R.mergeRollups(a, b);
    assert.strictEqual(m.totals.gross, 2000);
    assert.strictEqual(m.totals.commission, 150);
    assert.strictEqual(m.totals.count, 2);
});

check('merging takes the highest single travel charge, not their sum', () => {
    const a = R.foldRows([booking({ travelCharge: { amount: 40, distanceKm: 5 } })]);
    const b = R.foldRows([booking({ travelCharge: { amount: 90, distanceKm: 9 } })]);
    const m = R.mergeRollups(a, b);
    assert.strictEqual(m.travel.highest, 90);
    assert.strictEqual(m.travel.total, 130);
    assert.strictEqual(m.travel.count, 2);
});

console.log('\nThe rendered figures come from the buckets');

check('the array entry points go through the same buckets', () => {
    // If these ever stop delegating there are two definitions of the money
    // again, and only one of them gets fixed next time.
    const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'EarningsAnalyticsService.js'), 'utf8');
    ['getOverviewStats', 'getRevenueSources', 'getCategoryBreakdown', 'getTopPartners',
        'getPaymentAnalytics', 'getTravelAnalytics', 'getTopCategories'].forEach(fn => {
            const body = src.slice(src.indexOf(`static ${fn}(`), src.indexOf(`static ${fn}(`) + 700);
            assert.ok(/R\.foldRows\(/.test(body), `${fn} must fold its rows into the shared buckets`);
        });
});

check('a tie in the top five resolves the same way every time', () => {
    // Equal revenue used to leave the order to whatever the data happened to
    // produce, so the same screen refreshed showed a different five.
    const rollup = R.emptyRollup();
    ['Zeta', 'Alpha', 'Mid'].forEach((name, i) => {
        rollup.byPartner['p' + i] = { name, avatar: '', revenue: 100, bookings: 1, ratingSum: 0, ratingCount: 0 };
    });
    const once = S.topPartnersFromRollup(rollup).map(p => p.name);
    const twice = S.topPartnersFromRollup(rollup).map(p => p.name);
    assert.deepStrictEqual(once, twice);
    assert.deepStrictEqual(once, ['Alpha', 'Mid', 'Zeta']);
});

check('a bin with nothing in it still appears, at zero', () => {
    const rollup = R.foldRows([booking({ createdAt: new Date('2026-03-15T10:00:00') })], { interval: 'day' });
    const series = S.binFromRollup(rollup.byBin, new Date('2026-03-14'), new Date('2026-03-16'), 'day', 'gross');
    assert.strictEqual(series.length, 3);
    assert.deepStrictEqual(series.map(p => p.value), [0, 1000, 0]);
});

check('a single day is drawn by the hour, not as one column', () => {
    // Binning today by day gives one bar showing the total already printed on
    // the card above it. The question "today" asks is when the work happened.
    const { interval } = S.getPeriodDates('today', null, null);
    assert.strictEqual(interval, 'hour');

    const start = new Date('2026-03-15T00:00:00');
    const end = new Date('2026-03-15T23:59:59');
    assert.strictEqual(S.binSeries(start, end, 'hour').length, 24);
});

check('hourly bins land where the chart looks for them', () => {
    const rows = [
        booking({ createdAt: new Date('2026-03-15T09:30:00') }),
        booking({ createdAt: new Date('2026-03-15T09:45:00') }),
        booking({ createdAt: new Date('2026-03-15T14:05:00') })
    ];
    const start = new Date('2026-03-15T00:00:00');
    const end = new Date('2026-03-15T23:59:59');

    const series = S.binFromRollup(
        R.foldRows(rows, { interval: 'hour' }).byBin, start, end, 'hour', 'gross'
    );
    assert.strictEqual(series.length, 24);
    // Two jobs in the 9am hour, one at 2pm, nothing anywhere else.
    assert.strictEqual(series[9].value, 2000);
    assert.strictEqual(series[14].value, 1000);
    assert.strictEqual(series.reduce((s, p) => s + p.value, 0), 3000);
});

check('every breakdown accounts for the same money as the headline', () => {
    // The dashboard shows gross four different ways: split by category, by
    // where the charge came from, by how it was paid, and over time. They are
    // the same money. A bucket that drops a booking — or counts one twice —
    // makes one of them disagree, and nothing on the screen says so.
    const withPartner = (over) => booking({ providerId: { _id: 'p1', shopName: 'Shop' }, ...over });
    const rows = [
        withPartner({ serviceName: 'Plumbing', paymentMode: 'now' }),
        withPartner({ serviceName: 'Wiring', paymentMode: 'after', travelCharge: { amount: 40, distanceKm: 4 } }),
        withPartner({
            serviceName: 'Plumbing',
            totalAmount: 460,
            commissionSnapshot: { coinSubsidy: 40, bookingCategorySnapshot: { name: 'Plumbing' } },
            extraCharges: [{ item: 'Night Charge', amount: 60 }]
        }),
        withPartner({ serviceName: 'Painting', status: 'cancelled' })
    ];
    const r = R.foldRows(rows, { interval: 'day' });
    const gross = r.totals.gross;

    const add = (o, f) => Object.values(o).reduce((s, x) => s + f(x), 0);
    assert.strictEqual(add(r.byCategory, c => c.revenue), gross, 'categories');
    assert.strictEqual(add(r.byPayment, p => p.value), gross, 'payment split');
    assert.strictEqual(add(r.byBin, b => b.gross), gross, 'time bins');
    assert.strictEqual(add(r.byPartner, p => p.revenue), gross, 'partners');
    assert.strictEqual(
        Object.values(r.sources).reduce((s, v) => s + v, 0), gross, 'revenue sources'
    );

    // And the commission side.
    assert.strictEqual(add(r.byCategory, c => c.commission), r.totals.commission, 'category commission');
    assert.strictEqual(
        r.totals.netRevenue,
        r.totals.commission - r.totals.coinSubsidy - r.totals.offerSubsidy,
        'net revenue is commission less what the discounts cost'
    );

    // Counts too, not just amounts.
    assert.strictEqual(add(r.byCategory, c => c.bookings), rows.length, 'category counts');
    assert.strictEqual(add(r.byPayment, p => p.count), rows.length, 'payment counts');
});

check('a booking with no partner still counts toward the money', () => {
    // The partner breakdown is the one that legitimately does not cover
    // everything: a booking nobody has accepted yet has no partner to file it
    // under, but it is still revenue. Worth stating, so a future reader does
    // not "fix" the gap by inventing a partner for it.
    const r = R.foldRows([
        booking({ providerId: { _id: 'p1', shopName: 'Shop' } }),
        booking({ providerId: null })
    ]);

    assert.strictEqual(r.totals.gross, 2000);
    assert.strictEqual(r.totals.count, 2);
    // Both in the category and payment splits...
    assert.strictEqual(Object.values(r.byCategory).reduce((s, c) => s + c.bookings, 0), 2);
    // ...but only the assigned one has a partner.
    assert.strictEqual(Object.keys(r.byPartner).length, 1);
    assert.strictEqual(r.byPartner.p1.revenue, 1000);
});

check('the chart accounts for every rupee the headline does', () => {
    // The real invariant: a bin exists for every bucket the data can produce,
    // so the series adds up to the total printed above it. A year ending
    // mid-month used to walk its bins from mid-month too, run out before the
    // final month, and quietly leave that month's revenue off the chart.
    const periods = ['today', '7d', '30d', '90d', 'year'];

    periods.forEach(range => {
        const { currentStart, currentEnd, interval } = S.getPeriodDates(range, null, null);

        // One booking in the first bin, one in the last, one in between.
        const mid = new Date((currentStart.getTime() + currentEnd.getTime()) / 2);
        const rows = [currentStart, mid, currentEnd].map(d => booking({ createdAt: new Date(d) }));

        const rollup = R.foldRows(rows, { interval });
        const series = S.revenueTrendFromRollup(rollup, currentStart, currentEnd, interval);
        const drawn = series.reduce((sum, p) => sum + p.revenue, 0);

        assert.strictEqual(drawn, Math.round(rollup.totals.gross * 100) / 100,
            `${range}: the chart drew ${drawn} of ${rollup.totals.gross}`);
    });
});

check('every interval keys its bins one way', () => {
    // The chart's bins, the in-memory fold and the aggregation all have to
    // agree on what a bin is called, so they share one function.
    const when = new Date('2026-03-15T09:30:00');
    ['hour', 'day', 'month'].forEach(interval => {
        const fromSeries = S.binSeries(when, when, interval)[0].key;
        assert.strictEqual(fromSeries, S.binKeyFor(when, interval));
        assert.strictEqual(fromSeries, R.binKey(when, interval));
    });
});

check('binData and the rollup bin to the same buckets', () => {
    const rows = [
        booking({ createdAt: new Date('2026-03-15T23:30:00') }),
        booking({ createdAt: new Date('2026-03-16T00:30:00') })
    ];
    const start = new Date('2026-03-15');
    const end = new Date('2026-03-16T23:59:59');

    const direct = S.binData(rows, start, end, 'day', b => S.grossValue(b));
    const viaRollup = S.binFromRollup(R.foldRows(rows, { interval: 'day' }).byBin, start, end, 'day', 'gross');
    assert.deepStrictEqual(direct, viaRollup);
});

/* ------------------------------------------------------------------ */
/* And against the database, when one is offered                       */
/* ------------------------------------------------------------------ */

const URI = process.env.EARNINGS_TEST_URI;

const withDatabase = async () => {
    if (URI === process.env.MONGODB_URI) {
        console.error('\nREFUSING: EARNINGS_TEST_URI is the configured production database.');
        process.exit(1);
    }

    const mongoose = require('mongoose');
    const Booking = require('../models/Booking');
    await mongoose.connect(URI);

    const match = {};
    const rows = await Booking.find(match)
        .select('totalAmount adminCommission providerPayout coinDiscount offerSubsidy commissionSnapshot'
            + ' travelCharge paymentMode paymentStatus status createdAt serviceName extraCharges rating providerId')
        .lean();

    console.log(`\nAgainst ${rows.length} real bookings`);

    for (const interval of ['day', 'month']) {
        const inMemory = R.foldRows(rows, { interval });
        const fromDb = await R.fromDatabase(match, { interval });

        const near = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.005;
        check(`the two paths agree, binned by ${interval}`, () => {
            Object.keys(inMemory.totals).forEach(k => {
                assert.ok(near(inMemory.totals[k], fromDb.totals[k]),
                    `totals.${k}: ${inMemory.totals[k]} vs ${fromDb.totals[k]}`);
            });
            Object.keys(inMemory.sources).forEach(k => {
                assert.ok(near(inMemory.sources[k], fromDb.sources[k]),
                    `sources.${k}: ${inMemory.sources[k]} vs ${fromDb.sources[k]}`);
            });
            Object.keys(inMemory.byBin).forEach(k => {
                assert.ok(near(inMemory.byBin[k].gross, fromDb.byBin[k]?.gross),
                    `byBin[${k}].gross`);
            });
            Object.keys(inMemory.byCategory).forEach(k => {
                assert.ok(near(inMemory.byCategory[k].revenue, fromDb.byCategory[k]?.revenue),
                    `byCategory[${k}].revenue`);
            });
        });
    }

    await mongoose.disconnect();
};

(async () => {
    if (URI) await withDatabase();
    else console.log('\n  (set EARNINGS_TEST_URI to a throwaway database to also check the aggregation)');

    console.log(`\n${passed} earnings rollup checks passed.\n`);
})().catch(e => { console.error(e); process.exit(1); });
