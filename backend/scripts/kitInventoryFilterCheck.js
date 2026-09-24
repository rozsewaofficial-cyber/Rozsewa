/**
 * Kit Orders & Inventory had two gaps the admin note called out directly:
 *
 * 1. A manual restock (adjustStock) only console.log'd the change — once the
 *    process restarted, "when was this item last restocked, and by how much"
 *    had no answer. The Inventory screen also had no category or low-stock
 *    filter at all, despite the summary already computing per-item state.
 * 2. Kit Orders' backend already understood categoryId/dateFrom/dateTo, but
 *    the admin screen never sent them and had no city filter (an order has
 *    no city of its own — the Sewak who placed it does), so none of it was
 *    reachable.
 *
 * These pin: adjustStock writes an immutable KitStockLedger row instead of
 * only logging, a dated/filterable ledger endpoint exists, the inventory
 * summary accepts category and stock-state filters without the state filter
 * also zeroing out the totals tiles, orders accept a city filter resolved
 * through the Sewak's Provider record, and the admin screen actually wires
 * all of it up.
 *
 *   node scripts/kitInventoryFilterCheck.js
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
    const next = src.indexOf('\nconst ', start + startMarker.length);
    return next === -1 ? src.slice(start) : src.slice(start, next);
};

const kitController = read('controllers/starterKitController.js');
const orderController = read('controllers/kitOrderController.js');
const ledgerModel = read('models/KitStockLedger.js');
const ui = feRead('modules/admin/pages/AdminKitOrders.jsx');

console.log('\nA restock leaves a dated, immutable trace');

check('the ledger model exists with the fields a restock needs to explain itself', () => {
    assert.ok(/delta: \{ type: Number, required: true \}/.test(ledgerModel));
    assert.ok(/previousStock: \{ type: Number, required: true \}/.test(ledgerModel));
    assert.ok(/newStock: \{ type: Number, required: true \}/.test(ledgerModel));
});

check('adjustStock writes a row instead of only logging to the console', () => {
    const fn = sliceFn(kitController, 'const adjustStock');
    assert.ok(/KitStockLedger\.create\(/.test(fn));
    assert.ok(!/console\.log\(`\[KitStock\]/.test(fn), 'the old console-only trail should be gone, not duplicated');
});

check('a dated, filterable ledger endpoint exists and is routed', () => {
    assert.ok(/const getStockLedger = async/.test(kitController));
    const routes = read('routes/adminRoutes.js');
    assert.ok(/router\.get\('\/kit-inventory\/ledger'/.test(routes));
});

console.log('\nThe inventory summary can be narrowed without breaking the totals tiles');

check('category and stock-state both narrow the query', () => {
    const fn = sliceFn(kitController, 'const getInventorySummary');
    assert.ok(/if \(categoryId.*query\.categoryId = categoryId;/.test(fn));
    assert.ok(/rows = rows\.filter\(r => r\.state === state\)/.test(fn));
});

check('totals are computed before the state filter narrows the rows', () => {
    const fn = sliceFn(kitController, 'const getInventorySummary');
    const totalsAt = fn.indexOf('const totals = {');
    const stateFilterAt = fn.indexOf("if (state && ['backorder'");
    assert.ok(totalsAt > -1 && stateFilterAt > totalsAt,
        'otherwise switching to "Low Stock" would make every other tile read 0 too');
});

console.log('\nOrders can be narrowed by city, resolved through the Sewak who placed them');

check('a city filter resolves through Provider, not a field on the order itself', () => {
    const fn = sliceFn(orderController, 'const getAdminOrders');
    assert.ok(/Provider\.find\(\{ city: new RegExp/.test(fn));
});

console.log('\nThe admin screen actually wires all of this up');

check('Orders sends category, city and the date range', () => {
    const fn = sliceFn(ui, 'const fetchOrders');
    assert.ok(/categoryId: categoryFilter/.test(fn));
    assert.ok(/city: cityFilter/.test(fn));
    assert.ok(/dateFrom: orderDateFrom/.test(fn) && /dateTo: orderDateTo/.test(fn));
});

check('Inventory sends category and state, and fetches the ledger too', () => {
    const fn = sliceFn(ui, 'const fetchInventory');
    assert.ok(/categoryId: invCategoryFilter/.test(fn));
    assert.ok(/state: invStateFilter/.test(fn));
    assert.ok(/fetchInventory\(\); fetchLedger\(\)/.test(ui), 'switching to the Inventory tab loads the log too');
});

check('the stat tiles double as the state filter, toggling rather than only ever adding', () => {
    assert.ok(/const toggleState = \(s\) => setInvStateFilter\(invStateFilter === s \? "" : s\)/.test(ui));
});

console.log(`\n${passed} kit-inventory-filter checks passed.\n`);
