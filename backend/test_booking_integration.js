const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, './.env') });

const Booking = require('./models/Booking');
const Provider = require('./models/Provider');
const Category = require('./models/Category');
const { Wallet } = require('./models/Wallet');
const FinancialLedger = require('./models/FinancialLedger');
const CommissionSlab = require('./models/CommissionSlab');
const ProviderSubscription = require('./models/ProviderSubscription');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const PartnerProgram = require('./models/PartnerProgram');

// Mock socket and notification services so controllers don't throw errors
const socketConfig = require('./config/socket');
socketConfig.getIO = () => ({
    to: () => ({ emit: () => {} }),
    emit: () => {}
});

jest = { mock: () => {} }; // dummy mock indicator

const { verifyEndOTP } = require('./controllers/bookingController');

// Helper to mock express req/res
function mockRes() {
    const res = {};
    res.statusCode = 200;
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    return res;
}

async function runIntegrationTests() {
    try {
        const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/Rojsewa";
        console.log(`Connecting to: ${mongoURI}`);
        await mongoose.connect(mongoURI);
        console.log('Connected to database.');

        // 1. Setup mock Category
        let testCategory = await Category.findOne({ name: 'Integration Test Cat' });
        if (!testCategory) {
            testCategory = await Category.create({
                name: 'Integration Test Cat',
                slug: 'integration-test-cat',
                isActive: true,
                commissionRate: 15 // legacy fallback
            });
        }

        // 2. Setup Partner Program Configuration (3 free trial jobs)
        await PartnerProgram.deleteMany({});
        const program = await PartnerProgram.create({
            ruleVersion: 1,
            freeTrialEnabled: true,
            freeServiceCount: 3,
            applyTo: 'all'
        });

        // 3. Setup Category Slabs: 
        // 0 - 500: 10%
        // 501 - 10000: 12%
        await CommissionSlab.deleteMany({ category: testCategory._id });
        const slab1 = await CommissionSlab.create({
            category: testCategory._id,
            minAmount: 0,
            maxAmount: 500,
            commissionRate: 10
        });
        const slab2 = await CommissionSlab.create({
            category: testCategory._id,
            minAmount: 501,
            maxAmount: 10000,
            commissionRate: 12
        });

        // 4. Setup mock Subscription Plan (5% rate)
        await SubscriptionPlan.deleteMany({ name: 'Integration Plan' });
        const plan = await SubscriptionPlan.create({
            name: 'Integration Plan',
            price: 999,
            planType: 'yearly',
            category: testCategory._id,
            offeredCommissionRate: 5,
            duration: 365,
            isActive: true
        });

        // 5. Clean up old test data
        await Provider.deleteMany({ ownerName: 'Integration Provider' });
        
        console.log('\n--- SCENARIO 1: Free Trial Booking Completion ---');
        // Setup provider in Free Trial status
        const providerTrial = await Provider.create({
            ownerName: 'Integration Provider',
            shopName: 'Trial Shop',
            mobile: '9999911111',
            password: 'password',
            address: 'Test Address',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDTRIAL',
            vendorType: testCategory._id,
            freeTrial: {
                usedServices: 1, // 1 used out of 3
                extraFreeServices: 0,
                trialStartedAt: new Date(),
                trialCompletedAt: null
            }
        });

        // Create Wallet
        await Wallet.create({ providerId: providerTrial._id, balance: 0, availableBalance: 0 });

        // Create Booking
        const booking1 = await Booking.create({
            userId: new mongoose.Types.ObjectId(),
            providerId: providerTrial._id,
            serviceName: 'Test Service',
            serviceId: 'SERV-001',
            bookingDate: '2026-06-30',
            bookingTime: '10:00 AM',
            totalAmount: 1000,
            status: 'started',
            paymentMode: 'after', // cash
            endOTP: '1234',
            address: 'Client Address'
        });

        const req1 = {
            params: { id: booking1._id },
            body: { otp: '1234' },
            user: { _id: providerTrial._id, role: 'provider' }
        };
        const res1 = mockRes();

        await verifyEndOTP(req1, res1);
        console.log('Status Code:', res1.statusCode);
        console.log('Response:', res1.body);

        // Assertions for Free Trial
        const updatedBooking1 = await Booking.findById(booking1._id);
        const updatedProviderTrial = await Provider.findById(providerTrial._id);
        const updatedWalletTrial = await Wallet.findOne({ providerId: providerTrial._id });

        console.log('Asserting Free Trial results...');
        if (updatedBooking1.status !== 'completed') throw new Error('Booking 1 status was not marked completed');
        if (updatedBooking1.adminCommission !== 0) throw new Error('Trial commission should be 0');
        if (updatedBooking1.commissionSnapshot.commissionRuleId !== 'FREE_TRIAL') throw new Error('Commission rule should be FREE_TRIAL');
        if (updatedProviderTrial.freeTrial.usedServices !== 2) throw new Error('freeTrial.usedServices did not increment');
        if (updatedWalletTrial.balance !== 0) throw new Error('Cash commission deduction should be 0');
        console.log('✓ Scenario 1: Passed');

        console.log('\n--- SCENARIO 2: Category Slab Booking Completion (Cash) ---');
        // Setup provider with completed free trial
        const providerSlab = await Provider.create({
            ownerName: 'Integration Provider',
            shopName: 'Slab Shop',
            mobile: '9999922222',
            password: 'password',
            address: 'Test Address',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDSLAB',
            vendorType: testCategory._id,
            freeTrial: {
                usedServices: 3,
                extraFreeServices: 0,
                trialStartedAt: new Date(),
                trialCompletedAt: new Date()
            }
        });

        await Wallet.create({ providerId: providerSlab._id, balance: 0, availableBalance: 0 });

        // Booking of 1000 should match slab 2 (12%) => Commission ₹120, Payout ₹880
        const booking2 = await Booking.create({
            userId: new mongoose.Types.ObjectId(),
            providerId: providerSlab._id,
            serviceName: 'Test Service',
            serviceId: 'SERV-001',
            bookingDate: '2026-06-30',
            bookingTime: '11:00 AM',
            totalAmount: 1000,
            status: 'started',
            paymentMode: 'after', // cash
            endOTP: '5678',
            address: 'Client Address'
        });

        const req2 = {
            params: { id: booking2._id },
            body: { otp: '5678' },
            user: { _id: providerSlab._id, role: 'provider' }
        };
        const res2 = mockRes();

        await verifyEndOTP(req2, res2);
        console.log('Status Code:', res2.statusCode);
        console.log('Response:', res2.body);

        const updatedBooking2 = await Booking.findById(booking2._id);
        const updatedWalletSlab = await Wallet.findOne({ providerId: providerSlab._id });
        const ledgerSlab = await FinancialLedger.findOne({ booking: booking2._id });

        console.log('Asserting Category Slab results...');
        if (updatedBooking2.status !== 'completed') throw new Error('Booking 2 status was not marked completed');
        if (updatedBooking2.adminCommission !== 120) throw new Error('Category commission should be 120 (12%)');
        if (updatedBooking2.providerPayout !== 880) throw new Error('Provider payout should be 880');
        if (updatedBooking2.commissionSnapshot.commissionRuleId !== 'CATEGORY_SLAB') throw new Error('Commission rule should be CATEGORY_SLAB');
        if (updatedWalletSlab.balance !== -120) throw new Error('Dues wallet.balance should be -120');
        if (!ledgerSlab || ledgerSlab.ledgerType !== 'COMMISSION' || ledgerSlab.amount !== -120) throw new Error('Ledger entry COMMISSON incorrect');
        console.log('✓ Scenario 2: Passed');

        console.log('\n--- SCENARIO 3: Active Subscription Booking Completion (Online) ---');
        // Setup provider with active subscription
        const providerSub = await Provider.create({
            ownerName: 'Integration Provider',
            shopName: 'Sub Shop',
            mobile: '9999933333',
            password: 'password',
            address: 'Test Address',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDSUB',
            vendorType: testCategory._id,
            freeTrial: {
                usedServices: 3,
                extraFreeServices: 0,
                trialStartedAt: new Date(),
                trialCompletedAt: new Date()
            },
            isSubscribed: true,
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // active 30 days
        });

        await ProviderSubscription.create({
            provider: providerSub._id,
            subscription: plan._id,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'active'
        });

        await Wallet.create({ providerId: providerSub._id, balance: 0, availableBalance: 0 });

        // Booking of 1000 with sub 5% => Commission ₹50, Payout ₹950 (online credit)
        const booking3 = await Booking.create({
            userId: new mongoose.Types.ObjectId(),
            providerId: providerSub._id,
            serviceName: 'Test Service',
            serviceId: 'SERV-001',
            bookingDate: '2026-06-30',
            bookingTime: '12:00 PM',
            totalAmount: 1000,
            status: 'started',
            paymentMode: 'now', // online
            endOTP: '9999',
            address: 'Client Address'
        });

        const req3 = {
            params: { id: booking3._id },
            body: { otp: '9999' },
            user: { _id: providerSub._id, role: 'provider' }
        };
        const res3 = mockRes();

        await verifyEndOTP(req3, res3);
        console.log('Status Code:', res3.statusCode);
        console.log('Response:', res3.body);

        const updatedBooking3 = await Booking.findById(booking3._id);
        const updatedWalletSub = await Wallet.findOne({ providerId: providerSub._id });
        const ledgerSub = await FinancialLedger.findOne({ booking: booking3._id });

        console.log('Asserting Subscription results...');
        if (updatedBooking3.status !== 'completed') throw new Error('Booking 3 status was not marked completed');
        if (updatedBooking3.adminCommission !== 50) throw new Error('Sub commission should be 50 (5%)');
        if (updatedBooking3.providerPayout !== 950) throw new Error('Provider payout should be 950');
        if (updatedBooking3.commissionSnapshot.commissionRuleId !== 'SUBSCRIPTION') throw new Error('Commission rule should be SUBSCRIPTION');
        if (updatedWalletSub.availableBalance !== 950) throw new Error('withdrawable availableBalance should be 950');
        if (updatedWalletSub.balance !== 0) throw new Error('Dues wallet.balance should remain 0');
        if (!ledgerSub || ledgerSub.ledgerType !== 'WALLET_CREDIT' || ledgerSub.amount !== 950) throw new Error('Ledger entry WALLET_CREDIT incorrect');
        console.log('✓ Scenario 3: Passed');

        console.log('\n=======================================');
        console.log('ALL BOOKING INTEGRATION SCENARIOS PASSED');
        console.log('=======================================');
        process.exit(0);

    } catch (e) {
        console.error('Integration test scenario failed:', e);
        process.exit(1);
    }
}

runIntegrationTests();
