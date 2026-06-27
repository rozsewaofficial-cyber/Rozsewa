const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, './.env') });

const Provider = require('./models/Provider');
const { Wallet } = require('./models/Wallet');
const FinancialLedger = require('./models/FinancialLedger');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const ProviderSubscription = require('./models/ProviderSubscription');
const AuditLog = require('./models/AuditLog');

// Helper to mock express req/res
function mockRes() {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
}

const {
    purchaseSubscription,
    renewSubscription,
    getProviderSubscriptionHistory,
    manualActivateSubscription,
    manualCancelSubscription
} = require('./controllers/v2CommissionController');

async function testSubscriptionEndpoints() {
    try {
        const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/Rojsewa";
        console.log(`Connecting to: ${mongoURI}`);
        await mongoose.connect(mongoURI);
        console.log('Connected to DB.');

        // Setup mock plan
        await SubscriptionPlan.deleteMany({ name: 'Integration Test Gold' });
        const goldPlan = await SubscriptionPlan.create({
            name: 'Integration Test Gold',
            price: 500,
            planType: 'yearly',
            offeredCommissionRate: 5,
            duration: 365,
            isActive: true
        });

        // Clean provider
        await Provider.deleteMany({ ownerName: 'Subscription Test Provider' });
        const provider = await Provider.create({
            ownerName: 'Subscription Test Provider',
            shopName: 'Sub Test Shop',
            mobile: '9999944444',
            password: 'password',
            address: 'Addr',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDSUBTEST'
        });

        // Setup wallet with availableBalance = 1200
        await Wallet.create({ providerId: provider._id, balance: 0, availableBalance: 1200 });

        console.log('\n--- Scenario 1: Provider Purchase Subscription via Available Wallet Balance ---');
        const req1 = {
            body: { planId: goldPlan._id },
            user: { _id: provider._id }
        };
        const res1 = mockRes();
        await purchaseSubscription(req1, res1);
        console.log('Status:', res1.statusCode);
        console.log('Body:', res1.body);

        if (res1.statusCode !== 200) throw new Error('Purchase failed');
        
        // Assertions
        const wallet1 = await Wallet.findOne({ providerId: provider._id });
        if (wallet1.availableBalance !== 700) throw new Error('Deduction incorrect: remaining should be 700');
        const sub1 = await ProviderSubscription.findOne({ provider: provider._id, status: 'active' });
        if (!sub1) throw new Error('Active subscription not found');
        const ledger1 = await FinancialLedger.findOne({ provider: provider._id, ledgerType: 'SUBSCRIPTION_PAYMENT' });
        if (!ledger1 || ledger1.amount !== -500) throw new Error('Ledger entry missing or incorrect');
        console.log('✓ Scenario 1: Passed');

        console.log('\n--- Scenario 2: Renew Subscription (Extending active expiry) ---');
        // Let's renew the same plan
        const req2 = {
            body: { planId: goldPlan._id },
            user: { _id: provider._id }
        };
        const res2 = mockRes();
        await renewSubscription(req2, res2);
        console.log('Status:', res2.statusCode);
        console.log('Body:', res2.body);

        if (res2.statusCode !== 200) throw new Error('Renewal failed');
        
        const wallet2 = await Wallet.findOne({ providerId: provider._id });
        if (wallet2.availableBalance !== 200) throw new Error('Renewal deduction incorrect: remaining should be 200');
        const sub2 = await ProviderSubscription.findOne({ provider: provider._id, status: 'active' });
        const expectedExpiry = new Date(sub1.endDate);
        expectedExpiry.setDate(expectedExpiry.getDate() + 365);
        
        // Expect expiry date to match extended date (within 5 seconds tolerance)
        if (Math.abs(sub2.endDate.getTime() - expectedExpiry.getTime()) > 5000) {
            throw new Error(`Renewal expiry was not extended properly. Got ${sub2.endDate}, expected ${expectedExpiry}`);
        }
        console.log('✓ Scenario 2: Passed');

        console.log('\n--- Scenario 3: Admin Manual Activation ---');
        // Setup another provider
        const provider2 = await Provider.create({
            ownerName: 'Subscription Test Provider',
            shopName: 'Sub Test Shop 2',
            mobile: '9999955555',
            password: 'password',
            address: 'Addr',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDSUBTEST2'
        });

        const req3 = {
            params: { id: provider2._id },
            body: { planId: goldPlan._id, reason: 'Special customer service activation' },
            user: { _id: new mongoose.Types.ObjectId(), ownerName: 'Admin Agent' } // Admin user mock
        };
        const res3 = mockRes();
        await manualActivateSubscription(req3, res3);
        console.log('Status:', res3.statusCode);
        console.log('Body:', res3.body);

        if (res3.statusCode !== 200) throw new Error('Admin manual activation failed');
        const p2 = await Provider.findById(provider2._id);
        if (!p2.isSubscribed || p2.commissionRate !== 5) throw new Error('Admin manual active flags not updated');
        console.log('✓ Scenario 3: Passed');

        console.log('\n--- Scenario 4: Admin Manual Cancellation ---');
        const req4 = {
            params: { id: provider2._id },
            body: { reason: 'Policy violation' },
            user: { _id: req3.user._id, ownerName: 'Admin Agent' }
        };
        const res4 = mockRes();
        await manualCancelSubscription(req4, res4);
        console.log('Status:', res4.statusCode);

        if (res4.statusCode !== 200) throw new Error('Admin manual cancellation failed');
        const p2Cancel = await Provider.findById(provider2._id);
        if (p2Cancel.isSubscribed) throw new Error('Provider still subscribed');
        const subCancelled = await ProviderSubscription.findOne({ provider: provider2._id, status: 'cancelled' });
        if (!subCancelled) throw new Error('Subscription status was not marked cancelled');
        console.log('✓ Scenario 4: Passed');

        console.log('\n=======================================');
        console.log('ALL SUBSCRIPTION SCENARIOS PASSED SUCCESSFULLY');
        console.log('=======================================');
        process.exit(0);

    } catch (e) {
        console.error('Subscription test scenario failed:', e);
        process.exit(1);
    }
}

testSubscriptionEndpoints();
