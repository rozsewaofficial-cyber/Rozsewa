const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, './.env') });

const Booking = require('./models/Booking');
const Setting = require('./models/Setting');
const Service = require('./models/Service');
const Provider = require('./models/Provider');

// Mock socket config getIO so controllers don't throw errors
const socketConfig = require('./config/socket');
socketConfig.getIO = () => {
    return {
        to: () => ({
            emit: () => {}
        }),
        emit: () => {}
    };
};

const { updateBookingStatusByProvider, updateBooking } = require('./controllers/bookingController');

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

async function runTests() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // Clean up
        await Setting.deleteOne({ key: 'max_bargain_discount_limit' });
        await Service.deleteMany({ name: { $in: ['Test Bargain Service', 'Test Night Service'] } });
        await Provider.deleteMany({ ownerName: { $in: ['Mock Provider 1', 'Mock Provider 2'] } });

        const userId = new mongoose.Types.ObjectId();
        
        // Setup Providers
        const provider1 = await Provider.create({
            ownerName: 'Mock Provider 1',
            shopName: 'Shop 1',
            mobile: '1111111111',
            password: 'password',
            address: 'Addr 1',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDTEST1'
        });

        const provider2 = await Provider.create({
            ownerName: 'Mock Provider 2',
            shopName: 'Shop 2',
            mobile: '2222222222',
            password: 'password',
            address: 'Addr 2',
            city: 'City',
            state: 'State',
            isOnline: true,
            status: 'verified',
            vendorCode: 'RSVNDTEST2'
        });

        // Setup service
        const service = await Service.create({
            providerId: provider1._id,
            name: 'Test Bargain Service',
            category: 'Beauty',
            price: 1000
        });

        console.log('\n--- SCENARIO 1: Partner accepts the customer\'s bargain offer ---');
        const booking1 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-06-30',
            bookingTime: '10:00 AM',
            totalAmount: 850,
            address: 'Test Address',
            customerOffer: 850,
            bargainDiscount: 150,
            couponDiscount: 0,
            totalDiscount: 150,
            originalFixedPrice: 1000,
            offerStatus: 'pending',
            status: 'pending'
        });

        const req1 = {
            params: { id: booking1._id },
            body: { status: 'confirmed', offerDecision: 'accept' },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res1 = mockRes();
        await updateBookingStatusByProvider(req1, res1);

        console.log('Status Code:', res1.statusCode);
        const updated1 = res1.body;
        console.log('Booking 1 - Status:', updated1.status); // confirmed
        console.log('Booking 1 - OfferStatus:', updated1.offerStatus); // accepted
        console.log('Booking 1 - pricingDecision:', updated1.pricingDecision); // customer_offer

        if (res1.statusCode !== 200 || updated1.status !== 'confirmed' || updated1.offerStatus !== 'accepted' || updated1.pricingDecision !== 'customer_offer') {
            throw new Error('Scenario 1 assertions failed');
        }


        console.log('\n--- SCENARIO 2: Partner rejects the offer and accepts at Fixed Price ---');
        const booking2 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-06-30',
            bookingTime: '11:00 PM', // night time
            totalAmount: 935, // 850 offer + 85 night charge (10% ratio)
            address: 'Test Address',
            customerOffer: 850,
            bargainDiscount: 150,
            couponDiscount: 0,
            totalDiscount: 150,
            originalFixedPrice: 1100, // 1000 base + 100 night charge
            extraCharges: [{ item: 'Night Charge (10%)', amount: 85 }],
            offerStatus: 'pending',
            status: 'pending'
        });

        const req2 = {
            params: { id: booking2._id },
            body: { status: 'confirmed', offerDecision: 'fixed_price' },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res2 = mockRes();
        await updateBookingStatusByProvider(req2, res2);

        console.log('Status Code:', res2.statusCode);
        const updated2 = res2.body;
        console.log('Booking 2 - Status:', updated2.status); // confirmed
        console.log('Booking 2 - OfferStatus:', updated2.offerStatus); // rejected_fixed_price
        console.log('Booking 2 - TotalAmount (Reverted to fixed):', updated2.totalAmount); // 1100
        console.log('Booking 2 - extraCharges Night Charge:', updated2.extraCharges[0].amount); // 100
        console.log('Booking 2 - pricingDecision:', updated2.pricingDecision); // fixed_price

        if (res2.statusCode !== 200 || updated2.status !== 'confirmed' || updated2.offerStatus !== 'rejected_fixed_price' || updated2.totalAmount !== 1100 || updated2.extraCharges[0].amount !== 100 || updated2.pricingDecision !== 'fixed_price') {
            throw new Error('Scenario 2 assertions failed');
        }


        console.log('\n--- SCENARIO 3: Duplicate Action Race Condition Check ---');
        const booking3 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-07-02',
            bookingTime: '10:00 AM',
            totalAmount: 850,
            address: 'Test Address',
            customerOffer: 850,
            bargainDiscount: 150,
            couponDiscount: 0,
            totalDiscount: 150,
            originalFixedPrice: 1000,
            offerStatus: 'accepted', // already processed
            status: 'confirmed' // already processed
        });

        const req3 = {
            params: { id: booking3._id },
            body: { status: 'confirmed', offerDecision: 'accept' },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res3 = mockRes();
        await updateBookingStatusByProvider(req3, res3);

        console.log('Status Code (should be 409):', res3.statusCode);
        if (res3.statusCode !== 409) {
            throw new Error('Scenario 3 assertions failed');
        }


        console.log('\n--- SCENARIO 4: Partner counter-offers (range validations) ---');
        const booking4 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-07-04',
            bookingTime: '10:00 AM',
            totalAmount: 800,
            address: 'Test Address',
            customerOffer: 800,
            bargainDiscount: 200,
            couponDiscount: 0,
            totalDiscount: 200,
            originalFixedPrice: 1000,
            offerStatus: 'pending',
            status: 'pending'
        });

        // 4.1: Counter offer <= customer offer (invalid)
        console.log('Test 4.1: Counter offer too low (₹750)');
        const req4_1 = {
            params: { id: booking4._id },
            body: { status: 'confirmed', offerDecision: 'counter', counterAmount: 750 },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res4_1 = mockRes();
        await updateBookingStatusByProvider(req4_1, res4_1);
        console.log('Status Code (should be 400):', res4_1.statusCode);

        // 4.2: Counter offer > originalFixedPrice (invalid)
        console.log('Test 4.2: Counter offer too high (₹1100)');
        const req4_2 = {
            params: { id: booking4._id },
            body: { status: 'confirmed', offerDecision: 'counter', counterAmount: 1100 },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res4_2 = mockRes();
        await updateBookingStatusByProvider(req4_2, res4_2);
        console.log('Status Code (should be 400):', res4_2.statusCode);

        // 4.3: Valid counter offer (₹900)
        console.log('Test 4.3: Valid counter offer (₹900)');
        const req4_3 = {
            params: { id: booking4._id },
            body: { status: 'confirmed', offerDecision: 'counter', counterAmount: 900 },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res4_3 = mockRes();
        await updateBookingStatusByProvider(req4_3, res4_3);
        console.log('Status Code (should be 200):', res4_3.statusCode);
        const updated4 = res4_3.body;
        console.log('Booking 4 - status:', updated4?.status); // pending
        console.log('Booking 4 - offerStatus:', updated4?.offerStatus); // countered
        console.log('Booking 4 - partnerCounterOffer:', updated4?.partnerCounterOffer); // 900
        console.log('Booking 4 - providerId (Locked):', updated4?.providerId); // provider1._id

        if (res4_3.statusCode !== 200 || updated4.status !== 'pending' || updated4.offerStatus !== 'countered' || updated4.partnerCounterOffer !== 900) {
            throw new Error('Scenario 4 assertions failed');
        }


        console.log('\n--- SCENARIO 5: Another provider trying to counter/accept on already locked booking gets HTTP 403 ---');
        const req5 = {
            params: { id: booking4._id },
            body: { status: 'confirmed', offerDecision: 'accept' },
            user: { _id: provider2._id, role: 'provider', ownerName: provider2.ownerName }
        };
        const res5 = mockRes();
        await updateBookingStatusByProvider(req5, res5);
        console.log('Status Code (should be 403):', res5.statusCode);
        if (res5.statusCode !== 403) {
            throw new Error('Scenario 5 assertions failed');
        }


        console.log('\n--- SCENARIO 6: Customer accepts counter-offer (price recalculation & night charge scaling) ---');
        // Let's create a new booking that has night charge (10% ratio)
        // base customer offer = 800, night charge = 80, originalFixedPrice = 1100 (1000 base + 100 night)
        const booking6 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-07-06',
            bookingTime: '11:00 PM', // night time
            totalAmount: 880, // 800 offer + 80 night charge
            address: 'Test Address',
            customerOffer: 800,
            bargainDiscount: 200,
            couponDiscount: 0,
            totalDiscount: 200,
            originalFixedPrice: 1100, // 1000 base + 100 night charge
            extraCharges: [{ item: 'Night Charge (10%)', amount: 80 }],
            offerStatus: 'pending',
            status: 'pending'
        });

        // Provider counters with ₹900
        console.log('Test 6.1: Provider counters booking6 with ₹900');
        const req6_1 = {
            params: { id: booking6._id },
            body: { status: 'confirmed', offerDecision: 'counter', counterAmount: 900 },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res6_1 = mockRes();
        await updateBookingStatusByProvider(req6_1, res6_1);
        const counteredBooking6 = res6_1.body;
        console.log('Countered Booking 6 - partnerCounterOffer:', counteredBooking6.partnerCounterOffer);

        // Customer accepts
        console.log('Test 6.2: Customer accepts booking6 counter-offer');
        const req6_2 = {
            params: { id: booking6._id },
            body: { counterDecision: 'accept' },
            user: { _id: userId }
        };
        const res6_2 = mockRes();
        await updateBooking(req6_2, res6_2);
        console.log('Status Code (should be 200):', res6_2.statusCode);
        const acceptedBooking6 = res6_2.body;
        console.log('Booking 6 - status:', acceptedBooking6.status); // confirmed
        console.log('Booking 6 - offerStatus:', acceptedBooking6.offerStatus); // counter_accepted
        console.log('Booking 6 - pricingDecision:', acceptedBooking6.pricingDecision); // partner_counter_offer
        // New night charge should be scaled: (80/800) * 900 = 90
        console.log('Booking 6 - extraCharges Night Charge:', acceptedBooking6.extraCharges[0].amount); // 90
        // New total amount should be 900 + 90 = 990
        console.log('Booking 6 - totalAmount:', acceptedBooking6.totalAmount); // 990
        console.log('Booking 6 - bargainDiscount:', acceptedBooking6.bargainDiscount); // 1100 - 990 = 110

        if (res6_2.statusCode !== 200 || acceptedBooking6.status !== 'confirmed' || acceptedBooking6.offerStatus !== 'counter_accepted' || acceptedBooking6.totalAmount !== 990 || acceptedBooking6.extraCharges[0].amount !== 90 || acceptedBooking6.pricingDecision !== 'partner_counter_offer') {
            throw new Error('Scenario 6 assertions failed');
        }


        console.log('\n--- SCENARIO 7: Customer rejects counter-offer ---');
        const booking7 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-07-07',
            bookingTime: '10:00 AM',
            totalAmount: 800,
            address: 'Test Address',
            customerOffer: 800,
            bargainDiscount: 200,
            couponDiscount: 0,
            totalDiscount: 200,
            originalFixedPrice: 1000,
            offerStatus: 'pending',
            status: 'pending'
        });

        // Provider counters with ₹900
        const req7_1 = {
            params: { id: booking7._id },
            body: { status: 'confirmed', offerDecision: 'counter', counterAmount: 900 },
            user: { _id: provider1._id, role: 'provider', ownerName: provider1.ownerName }
        };
        const res7_1 = mockRes();
        await updateBookingStatusByProvider(req7_1, res7_1);

        // Customer rejects
        const req7_2 = {
            params: { id: booking7._id },
            body: { counterDecision: 'reject' },
            user: { _id: userId }
        };
        const res7_2 = mockRes();
        await updateBooking(req7_2, res7_2);
        console.log('Status Code (should be 200):', res7_2.statusCode);
        const rejectedBooking7 = res7_2.body;
        console.log('Booking 7 - status:', rejectedBooking7.status); // cancelled
        console.log('Booking 7 - offerStatus:', rejectedBooking7.offerStatus); // counter_rejected

        if (res7_2.statusCode !== 200 || rejectedBooking7.status !== 'cancelled' || rejectedBooking7.offerStatus !== 'counter_rejected') {
            throw new Error('Scenario 7 assertions failed');
        }


        console.log('\n--- SCENARIO 8: Expired counter-offer acceptance returns HTTP 410 ---');
        const booking8 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-07-08',
            bookingTime: '10:00 AM',
            totalAmount: 800,
            address: 'Test Address',
            customerOffer: 800,
            bargainDiscount: 200,
            couponDiscount: 0,
            totalDiscount: 200,
            originalFixedPrice: 1000,
            offerStatus: 'countered',
            partnerCounterOffer: 900,
            counterOfferExpiresAt: new Date(Date.now() - 1000), // expired 1s ago
            status: 'pending',
            providerId: provider1._id
        });

        const req8 = {
            params: { id: booking8._id },
            body: { counterDecision: 'accept' },
            user: { _id: userId }
        };
        const res8 = mockRes();
        await updateBooking(req8, res8);
        console.log('Status Code (should be 410):', res8.statusCode);
        console.log('Message:', res8.body.message); // This counter-offer has expired.

        if (res8.statusCode !== 410 || res8.body.message !== 'This counter-offer has expired.') {
            throw new Error('Scenario 8 assertions failed');
        }


        console.log('\n--- SCENARIO 9: Provider offline/inactive counter-offer acceptance returns HTTP 400 ---');
        // Let's set provider1 to offline
        provider1.isOnline = false;
        await provider1.save();

        const booking9 = await Booking.create({
            userId,
            serviceName: service.name,
            serviceId: service._id.toString(),
            bookingDate: '2026-07-09',
            bookingTime: '10:00 AM',
            totalAmount: 800,
            address: 'Test Address',
            customerOffer: 800,
            bargainDiscount: 200,
            couponDiscount: 0,
            totalDiscount: 200,
            originalFixedPrice: 1000,
            offerStatus: 'countered',
            partnerCounterOffer: 900,
            counterOfferExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // valid
            status: 'pending',
            providerId: provider1._id
        });

        const req9 = {
            params: { id: booking9._id },
            body: { counterDecision: 'accept' },
            user: { _id: userId }
        };
        const res9 = mockRes();
        await updateBooking(req9, res9);
        console.log('Status Code (should be 400):', res9.statusCode);
        console.log('Message:', res9.body.message); // The provider is no longer available.

        if (res9.statusCode !== 400 || res9.body.message !== 'The provider is no longer available.') {
            throw new Error('Scenario 9 assertions failed');
        }


        console.log('\nAll test cases passed successfully!');

        // Clean up
        await Setting.deleteOne({ key: 'max_bargain_discount_limit' });
        await Service.deleteMany({ name: { $in: ['Test Bargain Service', 'Test Night Service'] } });
        await Provider.deleteMany({ _id: { $in: [provider1._id, provider2._id] } });
        await Booking.deleteMany({ userId });
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('Test execution failed:', err);
        process.exit(1);
    }
}

runTests();
