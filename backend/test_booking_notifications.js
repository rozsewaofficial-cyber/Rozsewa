const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Provider = require('./models/Provider');
const Booking = require('./models/Booking');
const User = require('./models/User');
const NotificationLog = require('./models/NotificationLog');
const Notification = require('./models/Notification');
const { notifyUser } = require('./config/notificationService');

async function runTests() {
    console.log("=== STARTING BOOKING NOTIFICATIONS AUTOMATED TESTS ===");
    
    // Connect to Database
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✔ Connected to MongoDB successfully.");
    } catch (dbErr) {
        console.error("❌ Failed to connect to MongoDB:", dbErr.message);
        process.exit(1);
    }

    let mockProvider;
    let mockUser;
    let mockBooking;

    try {
        // 1. Create Mock Provider
        mockProvider = await Provider.create({
            ownerName: "Test Provider Owner",
            shopName: "Test Notification Shop",
            mobile: "919999999999", // Test 10-12 digit mobile
            password: "hashedpassword123",
            email: "rozsewaofficial@gmail.com", // Valid SMTP config destination
            vendorCode: "RSVNDTEST1",
            address: "123 Test Street",
            city: "Test City",
            state: "Test State",
            status: "verified",
            isOnline: true,
            fcmTokens: ["mock_web_fcm_token_123"],
            fcmTokenMobile: ["mock_mobile_fcm_token_456"]
        });
        console.log(`✔ Mock Provider created with ID: ${mockProvider._id}`);

        // 2. Create Mock Customer User (for regression tests)
        mockUser = await User.create({
            name: "Test Customer User",
            email: "testcustomer@example.com",
            mobile: "918888888888",
            password: "hashedpassword123",
            role: "customer",
            city: "Test City",
            state: "Test State"
        });
        console.log(`✔ Mock Customer User created with ID: ${mockUser._id}`);

        // 3. Create Mock Booking
        mockBooking = await Booking.create({
            userId: mockUser._id,
            providerId: mockProvider._id,
            serviceName: "Standard Plumbing Check",
            serviceId: "plumbing_01",
            bookingDate: "2026-06-30",
            bookingTime: "02:00 PM",
            totalAmount: 499,
            address: "456 Customer Ave, Test City",
            paymentMode: "after",
            status: "pending"
        });
        console.log(`✔ Mock Booking created with ID: ${mockBooking._id}`);

        // Clean up any existing logs for this mock booking to prevent interference
        await NotificationLog.deleteMany({ userId: mockProvider._id.toString() });
        await Notification.deleteMany({ recipientId: mockProvider._id });

        // ==========================================
        // TEST case 1: Multi-Channel Delivery (First Request)
        // ==========================================
        console.log("\n--- TEST 1: First Request Notification (Should send In-App, FCM, Email, and SMS) ---");
        const noti1 = await notifyUser({
            userId: mockProvider._id,
            userRole: 'provider',
            title: 'Urgent: Service Request!',
            message: `You received a new request for ${mockBooking.serviceName}. Accept now!`,
            type: 'booking',
            bookingId: mockBooking._id
        });
        
        if (noti1) {
            console.log("✔ Test 1 PASS: First notification returned successful DB log.");
        } else {
            console.error("❌ Test 1 FAIL: First notification returned null.");
        }

        // ==========================================
        // TEST case 2: Idempotency & Duplicate Prevention
        // ==========================================
        console.log("\n--- TEST 2: Duplicate Alert (Should be blocked atomically) ---");
        const noti2 = await notifyUser({
            userId: mockProvider._id,
            userRole: 'provider',
            title: 'Urgent: Service Request!',
            message: `You received a new request for ${mockBooking.serviceName}. Accept now!`,
            type: 'booking',
            bookingId: mockBooking._id
        });

        if (noti2 === null) {
            console.log("✔ Test 2 PASS: Duplicate notification was successfully blocked and returned null.");
        } else {
            console.error("❌ Test 2 FAIL: Duplicate notification was NOT blocked!");
        }

        // ==========================================
        // TEST case 3: Event Differentiation (Same Booking, Different Event)
        // ==========================================
        console.log("\n--- TEST 3: Different Event (Should be sent successfully) ---");
        const noti3 = await notifyUser({
            userId: mockProvider._id,
            userRole: 'provider',
            title: 'Booking Completed ✓',
            message: `Your booking #${mockBooking._id.toString().slice(-6)} for ${mockBooking.serviceName} has been successfully completed.`,
            type: 'booking',
            bookingId: mockBooking._id
        });

        if (noti3) {
            console.log("✔ Test 3 PASS: Completion event for same booking was allowed to deliver.");
        } else {
            console.error("❌ Test 3 FAIL: Completion event was incorrectly blocked.");
        }

        // ==========================================
        // TEST case 4: Atomic Concurrency Lock Check
        // ==========================================
        console.log("\n--- TEST 4: Concurrency Lock Check (Simulate parallel requests) ---");
        const newTitle = "New Booking Proposal Alert";
        const results = await Promise.all([
            notifyUser({
                userId: mockProvider._id,
                userRole: 'provider',
                title: newTitle,
                message: "Parallel request test message.",
                type: 'booking',
                bookingId: mockBooking._id
            }),
            notifyUser({
                userId: mockProvider._id,
                userRole: 'provider',
                title: newTitle,
                message: "Parallel request test message.",
                type: 'booking',
                bookingId: mockBooking._id
            })
        ]);

        const successfulCount = results.filter(r => r !== null).length;
        const blockedCount = results.filter(r => r === null).length;

        console.log(`Concurrency Results: Successful=${successfulCount}, Blocked=${blockedCount}`);
        if (successfulCount === 1 && blockedCount === 1) {
            console.log("✔ Test 4 PASS: Atomic lock correctly allowed exactly one notification to process and blocked the other concurrent attempt.");
        } else {
            console.error("❌ Test 4 FAIL: Concurrency locking failed!");
        }

        // ==========================================
        // TEST case 5: Payload Data Validation & Missing Fields Guard
        // ==========================================
        console.log("\n--- TEST 5: Payload Validation Guard (Booking missing fields) ---");
        const partialBooking = new Booking({
            userId: mockUser._id,
            providerId: mockProvider._id,
            serviceName: "Partial Check",
            serviceId: "partial_01"
        });
        await partialBooking.save({ validateBeforeSave: false });

        const noti5 = await notifyUser({
            userId: mockProvider._id,
            userRole: 'provider',
            title: 'Urgent: Service Request!',
            message: `Partial request alert.`,
            type: 'booking',
            bookingId: partialBooking._id
        });

        if (noti5) {
            console.log("✔ Test 5 PASS: Partial booking notification executed gracefully using default fallbacks without throwing errors.");
        } else {
            console.error("❌ Test 5 FAIL: Partial booking notification crashed or returned null.");
        }
        await Booking.deleteOne({ _id: partialBooking._id });

        // ==========================================
        // TEST case 6: Edge Case (Missing Email, SMS and Push work)
        // ==========================================
        console.log("\n--- TEST 6: Skipping Channels (Provider with no email address) ---");
        const noEmailProvider = await Provider.create({
            ownerName: "No Email Provider",
            shopName: "No Email Shop",
            mobile: "919999999888",
            password: "hashedpassword123",
            vendorCode: "RSVNDTEST2",
            address: "123 Test Street",
            city: "Test City",
            state: "Test State",
            status: "verified",
            isOnline: true
        });

        const noti6 = await notifyUser({
            userId: noEmailProvider._id,
            userRole: 'provider',
            title: 'Urgent: Service Request!',
            message: `Alert for no email provider.`,
            type: 'booking',
            bookingId: mockBooking._id
        });

        if (noti6) {
            console.log("✔ Test 6 PASS: Notification completed without email field, skipping it successfully.");
        } else {
            console.error("❌ Test 6 FAIL: Notification failed when email address was missing.");
        }
        await Provider.deleteOne({ _id: noEmailProvider._id });

        // ==========================================
        // TEST case 7: Regression Verification (Customer notification)
        // ==========================================
        console.log("\n--- TEST 7: Regression Check (Customer notification bypasses email/SMS logs) ---");
        const noti7 = await notifyUser({
            userId: mockUser._id,
            userRole: 'user',
            title: 'Payment Successful',
            message: `Your payment was successful.`,
            type: 'payment',
            bookingId: mockBooking._id
        });

        if (noti7) {
            console.log("✔ Test 7 PASS: Customer notification executed successfully with backward compatibility.");
        } else {
            console.error("❌ Test 7 FAIL: Customer notification was broken.");
        }

    } catch (testErr) {
        console.error("❌ Test execution CRASHED with error:", testErr);
    } finally {
        // CLEANUP Mock Testing Data
        console.log("\n--- CLEANING UP TEST DATA ---");
        if (mockBooking) {
            await Booking.deleteOne({ _id: mockBooking._id });
            console.log("✔ Mock Booking deleted.");
        }
        if (mockProvider) {
            await Provider.deleteOne({ _id: mockProvider._id });
            console.log("✔ Mock Provider deleted.");
        }
        if (mockUser) {
            await User.deleteOne({ _id: mockUser._id });
            console.log("✔ Mock Customer User deleted.");
        }

        // Clean up database notification logs created for mockProvider / mockUser
        if (mockProvider) {
            await NotificationLog.deleteMany({ userId: mockProvider._id.toString() });
            await Notification.deleteMany({ recipientId: mockProvider._id });
        }
        if (mockUser) {
            await NotificationLog.deleteMany({ userId: mockUser._id.toString() });
            await Notification.deleteMany({ recipientId: mockUser._id });
        }
        console.log("✔ Notification logs and records cleaned up.");

        // Disconnect DB
        await mongoose.disconnect();
        console.log("✔ Disconnected from MongoDB.");
        console.log("=== COMPLETED ALL TESTS ===");
    }
}

runTests();
