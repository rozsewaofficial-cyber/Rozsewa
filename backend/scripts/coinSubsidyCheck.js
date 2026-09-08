/**
 * Pins down the settlement arithmetic for platform-funded coin discounts.
 *
 * The rule: a partner is paid exactly the same whether or not the customer
 * spent coins. RozSewa carries the discount as a marketing cost. These checks
 * mirror the maths in verifyEndOTP so a future edit that shifts the cost back
 * onto the partner fails loudly.
 *
 *   node scripts/coinSubsidyCheck.js
 */
const assert = require('assert');
const CommissionService = require('../services/CommissionService');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

/**
 * Mirrors verifyEndOTP: commission and payout are computed on the order's
 * pre-discount value, and the cash settlement nets the subsidy off.
 */
const settle = ({ customerPaid, coinDiscount, rate, travelCharge = 0, paymentMode }) => {
    const grossOrderAmount = customerPaid + coinDiscount;
    const commissionable = Math.max(0, grossOrderAmount - travelCharge);
    const calc = CommissionService.calculate(commissionable, { rate, source: 'CATEGORY_SLAB' });

    const adminCommission = calc.platformAmount;
    const providerPayout = calc.providerAmount + travelCharge;

    // Cash: the partner holds `customerPaid` already, so only the difference moves.
    // Online: RozSewa holds the money and credits the full payout.
    const walletDelta = paymentMode === 'now'
        ? { availableBalance: providerPayout }
        : { balance: -(adminCommission - coinDiscount) };

    return { grossOrderAmount, adminCommission, providerPayout, walletDelta };
};

console.log('\nThe partner is paid the same with or without coins');
check('a Rs 1,200 order at 10% pays Rs 1,080 either way', () => {
    const withCoins = settle({ customerPaid: 960, coinDiscount: 240, rate: 10, paymentMode: 'now' });
    const without = settle({ customerPaid: 1200, coinDiscount: 0, rate: 10, paymentMode: 'now' });
    assert.strictEqual(withCoins.providerPayout, 1080);
    assert.strictEqual(without.providerPayout, 1080);
    assert.strictEqual(withCoins.providerPayout, without.providerPayout);
});

check('commission is charged on the pre-discount value, not the discounted one', () => {
    const { adminCommission, grossOrderAmount } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 10, paymentMode: 'now'
    });
    assert.strictEqual(grossOrderAmount, 1200);
    assert.strictEqual(adminCommission, 120); // 10% of 1200, not of 960
});

console.log('\nRozSewa carries the discount');
check('platform nets commission minus the subsidy (online)', () => {
    const { adminCommission, providerPayout } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 10, paymentMode: 'now'
    });
    // RozSewa collected 960 and must credit 1080, so it is 120 out of pocket.
    const platformNet = 960 - providerPayout;
    assert.strictEqual(platformNet, -120);
    assert.strictEqual(platformNet, adminCommission - 240);
});

check('the cash dues wallet moves by providerPayout - cashCollected', () => {
    const { walletDelta, providerPayout } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 10, paymentMode: 'after'
    });
    // wallet.balance is a DUES ledger: negative means the partner owes RozSewa.
    // Here the partner holds 960 but is owed 1080, so RozSewa owes them 120 and
    // the balance moves UP.
    assert.strictEqual(walletDelta.balance, providerPayout - 960);
    assert.strictEqual(walletDelta.balance, 120);
});

check('a discount larger than the commission credits the partner', () => {
    // 5% on 1200 is 60 commission, against a 240 discount.
    const { walletDelta } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 5, paymentMode: 'after'
    });
    assert.ok(walletDelta.balance > 0, 'partner should be credited, not debited');
    assert.strictEqual(walletDelta.balance, 180); // 240 - 60
});

console.log('\nNo regression when coins are not used');
check('a zero subsidy reduces to the original commission debit', () => {
    const { walletDelta, adminCommission } = settle({
        customerPaid: 1200, coinDiscount: 0, rate: 10, paymentMode: 'after'
    });
    assert.strictEqual(adminCommission, 120);
    assert.strictEqual(walletDelta.balance, -120); // straight commission debit
});

check('a zero subsidy online credits the plain payout', () => {
    const { walletDelta } = settle({
        customerPaid: 1200, coinDiscount: 0, rate: 10, paymentMode: 'now'
    });
    assert.strictEqual(walletDelta.availableBalance, 1080);
});

console.log('\nTravel charge stays commission-exempt and fully reimbursed');
check('travel charge is excluded from commission but added to payout', () => {
    // 1200 gross of which 100 is travel: commission applies to 1100 only.
    const { adminCommission, providerPayout } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 10, travelCharge: 100, paymentMode: 'now'
    });
    assert.strictEqual(adminCommission, 110);   // 10% of 1100
    assert.strictEqual(providerPayout, 1090);   // 990 + 100 travel
});

check('the cash identity still holds with a travel charge', () => {
    const { walletDelta, providerPayout } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 10, travelCharge: 100, paymentMode: 'after'
    });
    assert.strictEqual(walletDelta.balance, providerPayout - 960);
    assert.strictEqual(walletDelta.balance, 130);
});

console.log('\nZero-commission cases');
check('a free-trial booking still reimburses the full discount', () => {
    const { adminCommission, providerPayout, walletDelta } = settle({
        customerPaid: 960, coinDiscount: 240, rate: 0, paymentMode: 'after'
    });
    assert.strictEqual(adminCommission, 0);
    assert.strictEqual(providerPayout, 1200);
    // Nothing owed to RozSewa, and the whole 240 discount is credited back.
    assert.strictEqual(walletDelta.balance, 240);
});

console.log(`\n${passed} settlement checks passed.\n`);
