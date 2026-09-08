/**
 * End-to-end exercise of the RozSewa Coins lifecycle against a scratch MongoDB.
 *
 * Point COIN_TEST_URI at a THROWAWAY database — the script drops it on both
 * entry and exit. It deliberately refuses to run against the app's own
 * MONGODB_URI so it can never be aimed at production by accident.
 *
 *   COIN_TEST_URI="mongodb://127.0.0.1:27018/rozsewa_coin_test" \
 *     node scripts/coinIntegrationCheck.js
 */
const mongoose = require('mongoose');
const assert = require('assert');

const URI = process.env.COIN_TEST_URI;
if (!URI) {
    console.error('Refusing to run: set COIN_TEST_URI to a throwaway database.');
    process.exit(1);
}
require('dotenv').config();
if (process.env.MONGODB_URI && URI === process.env.MONGODB_URI) {
    console.error('Refusing to run against the application database.');
    process.exit(1);
}

const CoinService = require('../services/CoinService');
const CoinRewardService = require('../services/CoinRewardService');
const CoinWallet = require('../models/CoinWallet');
const CoinLot = require('../models/CoinLot');
const CoinLedger = require('../models/CoinLedger');
const CoinRedemption = require('../models/CoinRedemption');
const Setting = require('../models/Setting');
const User = require('../models/User');
const Booking = require('../models/Booking');

let passed = 0;
const check = async (label, fn) => {
    await fn();
    passed += 1;
    console.log(`  ok  ${label}`);
};

const newId = () => new mongoose.Types.ObjectId();

const makeCustomer = async (overrides = {}) =>
    await User.create({
        name: overrides.name || 'Test Customer',
        mobile: overrides.mobile || String(9000000000 + Math.floor(Math.random() * 999999999)).slice(0, 10),
        role: 'customer',
        ...overrides
    });

/** Creates a completed booking so the reward engine has something to count. */
const completeBooking = async (userId, providerId = null) =>
    await Booking.create({
        userId,
        providerId,
        serviceName: 'Test service',
        serviceId: 'TEST-SVC',
        bookingDate: '2026-01-01',
        bookingTime: '10:00',
        totalAmount: 1000,
        address: 'Test address',
        status: 'completed',
        paymentStatus: 'paid',
        completedAt: new Date()
    });

const run = async () => {
    await mongoose.connect(URI);
    await mongoose.connection.dropDatabase();
    // The idempotency guarantees under test are enforced by unique indexes.
    await Promise.all(mongoose.modelNames().map(n => mongoose.model(n).syncIndexes()));

    console.log('\nCredit, lots and the ledger');
    const alice = await makeCustomer({ name: 'Alice' });

    await check('a credit opens a lot and moves the balance', async () => {
        await CoinService.credit({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            coins: 3000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        const wallet = await CoinWallet.findOne({ ownerId: alice._id });
        assert.strictEqual(wallet.balance, 3000);
        assert.strictEqual(wallet.totalEarned, 3000);
        const lots = await CoinLot.find({ ownerId: alice._id });
        assert.strictEqual(lots.length, 1);
        assert.strictEqual(lots[0].remaining, 3000);
    });

    await check('the ledger row records before/after balances', async () => {
        const row = await CoinLedger.findOne({ ownerId: alice._id, type: 'CREDIT' });
        assert.strictEqual(row.previousBalance, 0);
        assert.strictEqual(row.newBalance, 3000);
        assert.strictEqual(row.monetaryValue, 300);
    });

    console.log('\nQuoting against the spec example (Rs 1,000 order, 3,000 coins)');
    await check('quotes 2,000 coins / Rs 200', async () => {
        const q = await CoinService.quote({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            amount: 1000, purpose: 'order'
        });
        assert.strictEqual(q.eligible, true);
        assert.strictEqual(q.maxCoins, 2000);
        assert.strictEqual(q.maxDiscount, 200);
    });

    await check('refuses an order below the minimum order value', async () => {
        const q = await CoinService.quote({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            amount: 150, purpose: 'order'
        });
        assert.strictEqual(q.eligible, false);
        assert.match(q.reason, /199/);
    });

    console.log('\nRole isolation');
    await check('a customer cannot redeem against a subscription', async () => {
        const q = await CoinService.quote({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            amount: 999, purpose: 'subscription'
        });
        assert.strictEqual(q.eligible, false);
        assert.match(q.reason, /order discounts/i);
    });

    await check('a partner cannot redeem against an order', async () => {
        const partnerId = newId();
        await CoinService.credit({
            ownerId: partnerId, ownerType: 'partner', ownerModel: 'Provider',
            coins: 5000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        const q = await CoinService.quote({
            ownerId: partnerId, ownerType: 'partner', ownerModel: 'Provider',
            amount: 1000, purpose: 'order'
        });
        assert.strictEqual(q.eligible, false);
        assert.match(q.reason, /subscription discounts/i);

        // ...but the same wallet works for a subscription, at the 50% cap.
        const sub = await CoinService.quote({
            ownerId: partnerId, ownerType: 'partner', ownerModel: 'Provider',
            amount: 999, purpose: 'subscription'
        });
        assert.strictEqual(sub.maxCoins, 4990);
        assert.strictEqual(sub.maxDiscount, 499);
    });

    console.log('\nHold, commit and release');
    await check('a hold removes coins from the spendable balance', async () => {
        const { redemption, discount } = await CoinService.hold({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, amount: 1000, purpose: 'order'
        });
        assert.strictEqual(discount, 200);
        const wallet = await CoinWallet.findOne({ ownerId: alice._id });
        assert.strictEqual(wallet.balance, 1000);
        // Not spent yet — only reserved.
        assert.strictEqual(wallet.totalUsed, 0);
        const debit = await CoinLedger.findOne({ referenceId: redemption._id.toString(), type: 'DEBIT' });
        assert.strictEqual(debit.status, 'pending');
        global.__hold = redemption;
    });

    await check('releasing a hold puts the coins back on their original lot', async () => {
        const lotBefore = await CoinLot.findOne({ ownerId: alice._id });
        const originalExpiry = lotBefore.expiryDate.getTime();

        await CoinService.release(global.__hold._id, 'test release');

        const wallet = await CoinWallet.findOne({ ownerId: alice._id });
        assert.strictEqual(wallet.balance, 3000);
        const lot = await CoinLot.findOne({ ownerId: alice._id });
        assert.strictEqual(lot.remaining, 3000);
        assert.strictEqual(lot.status, 'active');
        // The expiry date must survive a release, otherwise an abandoned
        // checkout could be used to launder an ageing balance into a fresh one.
        assert.strictEqual(lot.expiryDate.getTime(), originalExpiry);
    });

    await check('releasing twice is a no-op', async () => {
        await CoinService.release(global.__hold._id, 'again');
        const wallet = await CoinWallet.findOne({ ownerId: alice._id });
        assert.strictEqual(wallet.balance, 3000);
    });

    await check('committing a hold marks the coins genuinely used', async () => {
        const { redemption } = await CoinService.hold({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, amount: 1000, purpose: 'order'
        });
        await CoinService.commit(redemption._id, { referenceId: 'BOOK1', referenceModel: 'Booking' });
        const wallet = await CoinWallet.findOne({ ownerId: alice._id });
        assert.strictEqual(wallet.balance, 1000);
        assert.strictEqual(wallet.totalUsed, 2000);
        const debit = await CoinLedger.findOne({ referenceId: redemption._id.toString(), type: 'DEBIT' });
        assert.strictEqual(debit.status, 'completed');
        global.__committed = redemption;
    });

    await check('committing twice is a no-op', async () => {
        await CoinService.commit(global.__committed._id, { referenceId: 'BOOK1' });
        const wallet = await CoinWallet.findOne({ ownerId: alice._id });
        assert.strictEqual(wallet.totalUsed, 2000);
    });

    await check('a hold cannot exceed the quoted cap', async () => {
        await assert.rejects(
            CoinService.hold({
                ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
                coins: 999999, amount: 1000, purpose: 'order'
            }),
            /at most/
        );
    });

    await check('a wallet cannot be overdrawn by concurrent holds', async () => {
        const bob = await makeCustomer({ name: 'Bob' });
        await CoinService.credit({
            ownerId: bob._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        // Both ask for the full balance at once; exactly one must win.
        const results = await Promise.allSettled([
            CoinService.hold({ ownerId: bob._id, ownerType: 'customer', ownerModel: 'User', coins: 2000, amount: 10000, purpose: 'order' }),
            CoinService.hold({ ownerId: bob._id, ownerType: 'customer', ownerModel: 'User', coins: 2000, amount: 10000, purpose: 'order' })
        ]);
        const ok = results.filter(r => r.status === 'fulfilled');
        assert.strictEqual(ok.length, 1, 'exactly one concurrent hold should succeed');
        const wallet = await CoinWallet.findOne({ ownerId: bob._id });
        assert.strictEqual(wallet.balance, 0);
        assert.ok(wallet.balance >= 0);
    });

    console.log('\nEarning rewards on a completed booking');
    const carol = await makeCustomer({ name: 'Carol' });

    await check('the first completed order pays the first-order reward', async () => {
        const booking = await completeBooking(carol._id);
        await CoinRewardService.onBookingCompleted(booking._id);
        const wallet = await CoinWallet.findOne({ ownerId: carol._id });
        // 100 first-order coins. The 1-order target is suppressed by the
        // no-double-reward rule, so the balance is 100 and not 200.
        assert.strictEqual(wallet.balance, 100);
        const rows = await CoinLedger.find({ ownerId: carol._id, type: 'CREDIT' });
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].source, 'FIRST_ORDER');
        global.__carolBooking = booking;
    });

    await check('re-running completion does not pay twice', async () => {
        await CoinRewardService.onBookingCompleted(global.__carolBooking._id);
        await CoinRewardService.onBookingCompleted(global.__carolBooking._id);
        const wallet = await CoinWallet.findOne({ ownerId: carol._id });
        assert.strictEqual(wallet.balance, 100);
    });

    await check('crossing the 5-order target pays 300 coins, once', async () => {
        for (let i = 0; i < 4; i += 1) {
            const b = await completeBooking(carol._id);
            await CoinRewardService.onBookingCompleted(b._id);
        }
        const wallet = await CoinWallet.findOne({ ownerId: carol._id });
        // 100 first-order + 300 for the 5-order tier.
        assert.strictEqual(wallet.balance, 400);
        const targets = await CoinLedger.find({ ownerId: carol._id, source: 'TARGET_ACHIEVEMENT' });
        assert.strictEqual(targets.length, 1);
        assert.strictEqual(targets[0].coins, 300);
    });

    await check('cancelled and refunded orders do not count toward targets', async () => {
        const before = await CoinRewardService.countEligibleOrders('userId', carol._id);
        await Booking.create({
            userId: carol._id, serviceName: 'x', serviceId: 'x', bookingDate: '2026-01-01',
            bookingTime: '10:00', totalAmount: 500, address: 'a', status: 'cancelled'
        });
        await Booking.create({
            userId: carol._id, serviceName: 'x', serviceId: 'x', bookingDate: '2026-01-01',
            bookingTime: '10:00', totalAmount: 500, address: 'a', status: 'completed',
            paymentStatus: 'refunded'
        });
        const after = await CoinRewardService.countEligibleOrders('userId', carol._id);
        assert.strictEqual(after, before);
    });

    console.log('\nReferral settlement');
    await check('a referrer is paid only once their referee completes a first order', async () => {
        const referrer = await makeCustomer({ name: 'Referrer', referralCode: 'REFCODE1' });
        const referee = await makeCustomer({ name: 'Referee', referredBy: 'REFCODE1' });

        let wallet = await CoinWallet.findOne({ ownerId: referrer._id });
        assert.strictEqual(wallet, null, 'no reward before the referee orders');

        const booking = await completeBooking(referee._id);
        await CoinRewardService.onBookingCompleted(booking._id);

        wallet = await CoinWallet.findOne({ ownerId: referrer._id });
        assert.strictEqual(wallet.balance, 200);
        const refreshed = await User.findById(referee._id);
        assert.strictEqual(refreshed.referralRewarded, true);
        global.__referrer = referrer;
        global.__refereeBooking = booking;
    });

    await check('a second order by the same referee pays nothing more', async () => {
        const b = await completeBooking((await User.findOne({ name: 'Referee' }))._id);
        await CoinRewardService.onBookingCompleted(b._id);
        const wallet = await CoinWallet.findOne({ ownerId: global.__referrer._id });
        assert.strictEqual(wallet.balance, 200);
    });

    await check('self-referral by shared mobile is blocked', async () => {
        const r = await makeCustomer({ name: 'Fraudster', mobile: '9876500011', referralCode: 'FRAUD1' });
        const f = await makeCustomer({ name: 'Fraudster Alt', mobile: '9876500011', referredBy: 'FRAUD1' });
        const b = await completeBooking(f._id);
        await CoinRewardService.onBookingCompleted(b._id);
        const wallet = await CoinWallet.findOne({ ownerId: r._id });
        assert.strictEqual(wallet, null, 'no referral reward for a shared mobile');
        const refreshed = await User.findById(f._id);
        assert.match(refreshed.referralBlockedReason, /same mobile/);
    });

    console.log('\nClawback when a rewarded order is reversed');
    await check('cancelling the order reverses its reward and refunds spent coins', async () => {
        const dave = await makeCustomer({ name: 'Dave' });
        await CoinService.credit({
            ownerId: dave._id, ownerType: 'customer', ownerModel: 'User',
            coins: 3000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        const { redemption } = await CoinService.hold({
            ownerId: dave._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, amount: 1000, purpose: 'order'
        });

        const booking = await completeBooking(dave._id);
        booking.coinRedemptionId = redemption._id;
        booking.coinsRedeemed = 2000;
        booking.coinDiscount = 200;
        await booking.save();

        await CoinService.commit(redemption._id, { referenceId: booking._id.toString(), referenceModel: 'Booking' });
        await CoinRewardService.onBookingCompleted(booking._id);

        let wallet = await CoinWallet.findOne({ ownerId: dave._id });
        // 3000 seeded - 2000 spent + 100 first-order reward.
        assert.strictEqual(wallet.balance, 1100);

        await CoinRewardService.onBookingReversed(booking._id, 'cancelled in test');

        wallet = await CoinWallet.findOne({ ownerId: dave._id });
        // Spent coins returned (+2000), reward clawed back (-100).
        assert.strictEqual(wallet.balance, 3000);
        const reversal = await CoinLedger.findOne({ ownerId: dave._id, source: 'CLAWBACK' });
        assert.strictEqual(reversal.coins, 100);
    });

    await check('a clawback never drives a wallet negative', async () => {
        const erin = await makeCustomer({ name: 'Erin' });
        const booking = await completeBooking(erin._id);
        await CoinRewardService.onBookingCompleted(booking._id);
        // Spend everything the reward gave her, then reverse the order.
        const { redemption } = await CoinService.hold({
            ownerId: erin._id, ownerType: 'customer', ownerModel: 'User',
            coins: 100, amount: 5000, purpose: 'order'
        });
        await CoinService.commit(redemption._id, { referenceId: 'OTHER', referenceModel: 'Booking' });

        await CoinRewardService.onBookingReversed(booking._id, 'cancelled after spending');
        const wallet = await CoinWallet.findOne({ ownerId: erin._id });
        assert.ok(wallet.balance >= 0, 'balance must never go negative');
        const reversal = await CoinLedger.findOne({ ownerId: erin._id, source: 'CLAWBACK' });
        assert.strictEqual(reversal.meta.shortfall, 100, 'the unrecoverable amount is recorded');
    });

    await check('cancelling via findOneAndUpdate also refunds the coins', async () => {
        // Several cancellation routes (admin, expired counter-offers) update
        // without loading a document, which skips document middleware — this
        // covers the query-middleware path that catches them.
        const jack = await makeCustomer({ name: 'Jack' });
        await CoinService.credit({
            ownerId: jack._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        const { redemption } = await CoinService.hold({
            ownerId: jack._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, amount: 1000, purpose: 'order'
        });
        const booking = await Booking.create({
            userId: jack._id, serviceName: 'x', serviceId: 'x', bookingDate: '2026-01-01',
            bookingTime: '10:00', totalAmount: 800, address: 'a', status: 'pending',
            coinRedemptionId: redemption._id, coinsRedeemed: 2000, coinDiscount: 200
        });

        assert.strictEqual((await CoinWallet.findOne({ ownerId: jack._id })).balance, 0);

        await Booking.findOneAndUpdate({ _id: booking._id }, { $set: { status: 'cancelled' } });

        // The hook fires on setImmediate, so let the microtask queue drain.
        await new Promise(resolve => setTimeout(resolve, 300));

        const wallet = await CoinWallet.findOne({ ownerId: jack._id });
        assert.strictEqual(wallet.balance, 2000, 'coins should be refunded on a query-based cancel');
        assert.strictEqual((await CoinRedemption.findById(redemption._id)).status, 'released');
    });

    console.log('\nExpiry');
    await check('coins past their expiry date lapse and are logged', async () => {
        const frank = await makeCustomer({ name: 'Frank' });
        await CoinService.credit({
            ownerId: frank._id, ownerType: 'customer', ownerModel: 'User',
            coins: 500, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        // Backdate the lot rather than waiting 90 days.
        await CoinLot.updateOne({ ownerId: frank._id }, { $set: { expiryDate: new Date(Date.now() - 1000) } });

        const result = await CoinRewardService.expireDueLots();
        assert.ok(result.coins >= 500);

        const wallet = await CoinWallet.findOne({ ownerId: frank._id });
        assert.strictEqual(wallet.balance, 0);
        assert.strictEqual(wallet.totalExpired, 500);
        const row = await CoinLedger.findOne({ ownerId: frank._id, type: 'EXPIRY' });
        assert.strictEqual(row.coins, 500);
    });

    await check('spending drains the soonest-expiring lot first', async () => {
        const gina = await makeCustomer({ name: 'Gina' });
        await CoinService.credit({
            ownerId: gina._id, ownerType: 'customer', ownerModel: 'User',
            coins: 1000, source: 'ADMIN_ADJUSTMENT', description: 'old', expiryDays: 10
        });
        await CoinService.credit({
            ownerId: gina._id, ownerType: 'customer', ownerModel: 'User',
            coins: 1000, source: 'ADMIN_ADJUSTMENT', description: 'new', expiryDays: 90
        });
        await CoinService.hold({
            ownerId: gina._id, ownerType: 'customer', ownerModel: 'User',
            coins: 1000, amount: 10000, purpose: 'order'
        });
        const lots = await CoinLot.find({ ownerId: gina._id }).sort({ expiryDate: 1 });
        assert.strictEqual(lots[0].remaining, 0, 'the sooner-expiring lot is spent first');
        assert.strictEqual(lots[0].status, 'exhausted');
        assert.strictEqual(lots[1].remaining, 1000);
    });

    await check('stale checkout holds are swept back to the wallet', async () => {
        const hank = await makeCustomer({ name: 'Hank' });
        await CoinService.credit({
            ownerId: hank._id, ownerType: 'customer', ownerModel: 'User',
            coins: 1000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        const { redemption } = await CoinService.hold({
            ownerId: hank._id, ownerType: 'customer', ownerModel: 'User',
            coins: 1000, amount: 10000, purpose: 'order'
        });
        await CoinRedemption.updateOne({ _id: redemption._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

        await CoinRewardService.releaseStaleHolds();

        const wallet = await CoinWallet.findOne({ ownerId: hank._id });
        assert.strictEqual(wallet.balance, 1000);
        const after = await CoinRedemption.findById(redemption._id);
        assert.strictEqual(after.status, 'released');
    });

    console.log('\nAdmin controls');
    await check('a frozen wallet cannot redeem but can still earn', async () => {
        const iris = await makeCustomer({ name: 'Iris' });
        await CoinService.credit({
            ownerId: iris._id, ownerType: 'customer', ownerModel: 'User',
            coins: 2000, source: 'ADMIN_ADJUSTMENT', description: 'seed'
        });
        await CoinWallet.updateOne({ ownerId: iris._id }, { $set: { isFrozen: true, freezeReason: 'test' } });

        const q = await CoinService.quote({
            ownerId: iris._id, ownerType: 'customer', ownerModel: 'User',
            amount: 1000, purpose: 'order'
        });
        assert.strictEqual(q.eligible, false);
        await assert.rejects(CoinService.hold({
            ownerId: iris._id, ownerType: 'customer', ownerModel: 'User',
            coins: 100, amount: 1000, purpose: 'order'
        }));

        // Earning still works while frozen.
        await CoinService.credit({
            ownerId: iris._id, ownerType: 'customer', ownerModel: 'User',
            coins: 100, source: 'ADMIN_ADJUSTMENT', description: 'earned while frozen'
        });
        const wallet = await CoinWallet.findOne({ ownerId: iris._id });
        assert.strictEqual(wallet.balance, 2100);
    });

    await check('turning the programme off blocks all redemption', async () => {
        await Setting.findOneAndUpdate(
            { key: CoinService.CONFIG_KEY },
            { value: { ...CoinService.DEFAULT_CONFIG, enabled: false } },
            { upsert: true }
        );
        const q = await CoinService.quote({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            amount: 1000, purpose: 'order'
        });
        assert.strictEqual(q.eligible, false);
        await Setting.deleteOne({ key: CoinService.CONFIG_KEY });
    });

    await check('a changed conversion ratio is honoured', async () => {
        await CoinService.saveConfig({ coinsPerRupee: 20 });
        const q = await CoinService.quote({
            ownerId: alice._id, ownerType: 'customer', ownerModel: 'User',
            amount: 1000, purpose: 'order'
        });
        // At 20 coins/Rs, the Rs 200 cap now costs 4,000 coins — more than the
        // 1,000 Alice holds, so she is wallet-limited to Rs 50.
        assert.strictEqual(q.balanceValue, 50);
        assert.strictEqual(q.maxDiscount, 50);
        assert.strictEqual(q.maxCoins, 1000);
        await Setting.deleteOne({ key: CoinService.CONFIG_KEY });
    });

    console.log('\nLedger integrity');
    await check('every wallet balance equals the sum of its active lots', async () => {
        // The core invariant: spendable balance is exactly what remains in the
        // active lots. Held coins are already out of both, so they don't appear
        // on either side.
        const wallets = await CoinWallet.find();
        for (const wallet of wallets) {
            const lots = await CoinLot.find({ walletId: wallet._id, status: 'active' });
            const lotSum = lots.reduce((sum, l) => sum + l.remaining, 0);
            assert.strictEqual(
                wallet.balance,
                lotSum,
                `wallet ${wallet._id} balance (${wallet.balance}) != active lot total (${lotSum})`
            );
        }
    });

    await check('no wallet has a negative balance', async () => {
        const negative = await CoinWallet.countDocuments({ balance: { $lt: 0 } });
        assert.strictEqual(negative, 0);
    });

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log(`\n${passed} integration checks passed.\n`);
};

run().catch(async (err) => {
    console.error('\nFAILED:', err.message);
    console.error(err.stack);
    try { await mongoose.disconnect(); } catch (_) { }
    process.exit(1);
});
