/**
 * Earning note (item 41): city-wise report already existed on the Earnings
 * screen, but there was no "Total Expense" or "Total Profit" figure — the
 * screen only ever went as far as Net Revenue (Company Revenue minus coin
 * discounts). The user confirmed Total Expense means Partner Payouts (the
 * platform's one real cash outflow), so Total Profit is Net Revenue minus
 * that.
 *
 * These pin: overviewFromRollup returns both new fields, totalProfit's
 * sparkline is genuinely computed per-bin (netRevenue - payout for that
 * bin, not just a flat repeat of the total), the no-historical-data branch
 * stays in sync with the two new keys, and the KPI card grid renders both.
 *
 *   node scripts/earningsExpenseProfitCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');
const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const sliceFn = (src, startMarker) => {
    const start = src.indexOf(startMarker);
    if (start === -1) return '';
    const next = src.indexOf('\n    static ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const service = read('services/EarningsAnalyticsService.js');
const controller = read('controllers/commissionController.js');
const kpiCards = feRead('modules/admin/components/earnings/KpiCards.jsx');

console.log('\noverviewFromRollup carries Total Expense and a genuinely-computed Total Profit');

check('totalExpense is the same underlying figure as partnerPayout, per the confirmed definition', () => {
    const fn = sliceFn(service, 'static overviewFromRollup');
    assert.ok(/totalExpense: card\('payout', curr\.totals\.payout, prev\.totals\.payout\)/.test(fn));
});

check('totalProfit is Net Revenue minus payout, not a static or repeated figure', () => {
    const fn = sliceFn(service, 'static overviewFromRollup');
    assert.ok(/totalProfit: diffCard\(\s*curr\.totals\.netRevenue - curr\.totals\.payout,\s*prev\.totals\.netRevenue - prev\.totals\.payout,\s*'netRevenue', 'payout'\s*\)/.test(fn));
});

check("totalProfit's sparkline is built per-bin from the same two rollup fields, so a bin with heavy payouts actually dips", () => {
    const fn = sliceFn(service, 'const diffCard');
    assert.ok(/bin\[fieldA\] \|\| 0\) - \(bin\[fieldB\] \|\| 0\)/.test(fn),
        'a flat repeat of the period total would defeat the point of a trend line');
});

console.log('\nThe no-historical-data branch stays in sync with the two new keys');

check('an admin with zero bookings still gets zeroed totalExpense/totalProfit cards, not undefined ones', () => {
    const fn = sliceFn(controller, 'if (!hasHistoricalData)');
    assert.ok(/totalExpense: \{ value: 0, prevValue: 0, percentageChange: 0, sparkline: \[\] \}/.test(fn));
    assert.ok(/totalProfit: \{ value: 0, prevValue: 0, percentageChange: 0, sparkline: \[\] \}/.test(fn));
});

console.log('\nThe Earnings screen actually renders both new cards');

check('Total Expense and Total Profit cards are registered in the KPI grid', () => {
    assert.ok(/key: "totalExpense"/.test(kpiCards) && /label: "Total Expense"/.test(kpiCards));
    assert.ok(/key: "totalProfit"/.test(kpiCards) && /label: "Total Profit"/.test(kpiCards));
});

console.log(`\n${passed} earnings-expense-profit checks passed.\n`);
