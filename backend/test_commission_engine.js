const assert = require('assert');
const CommissionService = require('./services/CommissionService');

console.log("=== Running CommissionService Unit Tests ===");

try {
    // Test Case 1: Standard percentage calculation
    let res = CommissionService.calculate(1000, { rate: 10, source: 'CATEGORY_SLAB', ruleName: 'Slab Rate' });
    assert.strictEqual(res.commissionRate, 10);
    assert.strictEqual(res.commissionAmount, 100);
    assert.strictEqual(res.providerAmount, 900);
    assert.strictEqual(res.platformAmount, 100);
    assert.strictEqual(res.source, 'CATEGORY_SLAB');
    assert.strictEqual(res.ruleApplied, 'Slab Rate');
    console.log("✓ Test Case 1: Standard percentage calculation passed");

    // Test Case 2: Free trial (0% rate)
    res = CommissionService.calculate(1500, { rate: 0, isFreeTrial: true, source: 'FREE_TRIAL', ruleName: 'Free Trial Benefit' });
    assert.strictEqual(res.commissionRate, 0);
    assert.strictEqual(res.commissionAmount, 0);
    assert.strictEqual(res.providerAmount, 1500);
    assert.strictEqual(res.platformAmount, 0);
    assert.strictEqual(res.source, 'FREE_TRIAL');
    console.log("✓ Test Case 2: Free trial calculation passed");

    // Test Case 3: Commission waiver (0% rate)
    res = CommissionService.calculate(800, { rate: 0, isWaiver: true, source: 'WAIVER', ruleName: 'Temporary Waiver' });
    assert.strictEqual(res.commissionRate, 0);
    assert.strictEqual(res.commissionAmount, 0);
    assert.strictEqual(res.providerAmount, 800);
    assert.strictEqual(res.platformAmount, 0);
    console.log("✓ Test Case 3: Commission waiver calculation passed");

    // Test Case 4: Invalid booking amount (string instead of number)
    assert.throws(() => {
        CommissionService.calculate("invalid", { rate: 10 });
    }, /Invalid booking amount/);
    console.log("✓ Test Case 4: Invalid booking amount type throws exception");

    // Test Case 5: Negative booking amount
    assert.throws(() => {
        CommissionService.calculate(-100, { rate: 10 });
    }, /Invalid booking amount: must be non-negative/);
    console.log("✓ Test Case 5: Negative booking amount throws exception");

    // Test Case 6: Out of bounds commission rate
    assert.throws(() => {
        CommissionService.calculate(100, { rate: 105 });
    }, /Invalid commission rate/);
    assert.throws(() => {
        CommissionService.calculate(100, { rate: -5 });
    }, /Invalid commission rate/);
    console.log("✓ Test Case 6: Out of bounds commission rates throw exception");

    console.log("=== All CommissionService Unit Tests Passed Successfully! ===");
} catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
}
