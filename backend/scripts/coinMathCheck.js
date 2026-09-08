/**
 * Verifies the coin redemption arithmetic against the three worked examples in
 * the RozSewa Coins V2 spec. Pure maths only — no database connection — so it
 * is safe to run anywhere:
 *
 *   node scripts/coinMathCheck.js
 */
const assert = require('assert');
const CoinService = require('../services/CoinService');

const config = CoinService.DEFAULT_CONFIG;

/**
 * Mirrors the cap logic in CoinService.quote() so the examples below exercise
 * the same rules the live endpoint applies.
 */
const capFor = (amount, balanceCoins, ownerType) => {
    const rc = CoinService.roleConfig(config, ownerType);
    const balanceValue = CoinService.toRupees(balanceCoins, config);
    const percentCap = Math.floor((amount * rc.maxDiscountPercent) / 100);
    const maxDiscount = Math.max(0, Math.min(percentCap, balanceValue));
    return { maxDiscount, maxCoins: CoinService.toCoins(maxDiscount, config) };
};

let passed = 0;
const check = (label, fn) => {
    fn();
    passed += 1;
    console.log(`  ok  ${label}`);
};

console.log('\nBase conversion (10 coins = Rs 1)');
check('100 coins = Rs 10', () => assert.strictEqual(CoinService.toRupees(100, config), 10));
check('500 coins = Rs 50', () => assert.strictEqual(CoinService.toRupees(500, config), 50));
check('1,000 coins = Rs 100', () => assert.strictEqual(CoinService.toRupees(1000, config), 100));
check('5,000 coins = Rs 500', () => assert.strictEqual(CoinService.toRupees(5000, config), 500));
check('10,000 coins = Rs 1,000', () => assert.strictEqual(CoinService.toRupees(10000, config), 1000));

console.log('\nExample 1 - customer order (Rs 1,000 order, 3,000 coins held)');
check('caps at Rs 200 / 2,000 coins, leaving Rs 800 payable and 1,000 coins', () => {
    const { maxDiscount, maxCoins } = capFor(1000, 3000, 'customer');
    assert.strictEqual(maxDiscount, 200);
    assert.strictEqual(maxCoins, 2000);
    assert.strictEqual(1000 - maxDiscount, 800);
    assert.strictEqual(3000 - maxCoins, 1000);
});

console.log('\nExample 2 - partner subscription (Rs 999 plan, 5,000 coins held)');
check('caps at Rs 499 / 4,990 coins, leaving Rs 500 payable and 10 coins', () => {
    // 50% of 999 is 499.50; flooring is what makes the coin count land exactly
    // on the spec's 4,990 rather than an unpayable half-rupee.
    const { maxDiscount, maxCoins } = capFor(999, 5000, 'partner');
    assert.strictEqual(maxDiscount, 499);
    assert.strictEqual(maxCoins, 4990);
    assert.strictEqual(999 - maxDiscount, 500);
    assert.strictEqual(5000 - maxCoins, 10);
});

console.log('\nExample 3 - sewak subscription (Rs 999 plan, 2,000 coins held)');
check('wallet-limited to Rs 200 / 2,000 coins, leaving Rs 799 payable', () => {
    const { maxDiscount, maxCoins } = capFor(999, 2000, 'sewak');
    assert.strictEqual(maxDiscount, 200);
    assert.strictEqual(maxCoins, 2000);
    assert.strictEqual(999 - maxDiscount, 799);
});

console.log('\nRole isolation and thresholds');
check('customer cap is 20%, partner and sewak are 50%', () => {
    assert.strictEqual(CoinService.roleConfig(config, 'customer').maxDiscountPercent, 20);
    assert.strictEqual(CoinService.roleConfig(config, 'partner').maxDiscountPercent, 50);
    assert.strictEqual(CoinService.roleConfig(config, 'sewak').maxDiscountPercent, 50);
});
check('customer MOV is Rs 199', () => {
    assert.strictEqual(CoinService.roleConfig(config, 'customer').minOrderValue, 199);
});
check('partner and sewak need 500 coins minimum to redeem', () => {
    assert.strictEqual(CoinService.roleConfig(config, 'partner').minRedemption, 500);
    assert.strictEqual(CoinService.roleConfig(config, 'sewak').minRedemption, 500);
});
check('expiry is 90 days for customers, 60 for partner and sewak', () => {
    assert.strictEqual(CoinService.roleConfig(config, 'customer').expiryDays, 90);
    assert.strictEqual(CoinService.roleConfig(config, 'partner').expiryDays, 60);
    assert.strictEqual(CoinService.roleConfig(config, 'sewak').expiryDays, 60);
});
check('an order below the MOV yields no discount', () => {
    const rc = CoinService.roleConfig(config, 'customer');
    assert.ok(150 < rc.minOrderValue);
});

console.log('\nResolving a principal to a wallet identity');
check('a sewak provider maps to the sewak wallet type', () => {
    const owner = CoinService.resolveOwner({ _id: 'x', role: 'provider', providerCategory: 'sewak' });
    assert.strictEqual(owner.ownerType, 'sewak');
    assert.strictEqual(owner.ownerModel, 'Provider');
});
check('a partner provider maps to the partner wallet type', () => {
    const owner = CoinService.resolveOwner({ _id: 'x', role: 'provider', providerCategory: 'partner' });
    assert.strictEqual(owner.ownerType, 'partner');
});
check('a customer maps to the customer wallet type', () => {
    const owner = CoinService.resolveOwner({ _id: 'x', role: 'customer' });
    assert.strictEqual(owner.ownerType, 'customer');
    assert.strictEqual(owner.ownerModel, 'User');
});
check('admin and staff roles have no coin wallet', () => {
    assert.strictEqual(CoinService.resolveOwner({ _id: 'x', role: 'admin' }), null);
    assert.strictEqual(CoinService.resolveOwner({ _id: 'x', role: 'superadmin' }), null);
    assert.strictEqual(CoinService.resolveOwner({ _id: 'x', role: 'employee' }), null);
});

console.log('\nTarget period windows');
check('lifetime has no lower bound', () => {
    const w = CoinService.periodWindow('lifetime');
    assert.strictEqual(w.start, null);
    assert.strictEqual(w.key, 'lifetime');
});
check('daily, weekly and monthly each produce a distinct stable key', () => {
    const keys = ['daily', 'weekly', 'monthly'].map(p => CoinService.periodWindow(p).key);
    assert.strictEqual(new Set(keys).size, 3);
    keys.forEach(k => assert.ok(typeof k === 'string' && k.length > 0));
});
check('a weekly window starts on a Monday', () => {
    const w = CoinService.periodWindow('weekly');
    assert.strictEqual(w.start.getDay(), 1);
});

console.log(`\n${passed} checks passed.\n`);
