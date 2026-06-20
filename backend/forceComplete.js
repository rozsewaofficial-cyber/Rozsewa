require('dotenv').config({path: __dirname + '/.env'});
const mongoose = require('mongoose');

async function fixBooking() {
    try {
        console.log("Connecting to database...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected.");

        const Booking = require('./models/Booking');
        const { Wallet, Transaction } = require('./models/Wallet');
        const Provider = require('./models/Provider');

        // Find booking by partial ID
        const bookings = await Booking.find({});
        const booking = bookings.find(b => b._id.toString().toLowerCase().endsWith('ab743b'));

        if (!booking) {
            console.log("Booking 'ab743b' not found in the database at all!");
            process.exit(0);
        }

        console.log("Found booking:", booking._id);
        console.log("Current status:", booking.status);

        // Force complete
        booking.status = 'completed';
        
        // Calculate payout if not already done
        const adminCommission = (booking.totalAmount * 8) / 100; // Assuming 8%
        const providerPayout = booking.totalAmount - adminCommission;
        
        booking.adminCommission = adminCommission;
        booking.providerPayout = providerPayout;

        await booking.save();

        console.log("Booking marked as 'completed' successfully.");

        // Fix Wallet
        if (booking.providerId) {
            let wallet = await Wallet.findOne({ providerId: booking.providerId });
            if (wallet) {
                wallet.balance -= adminCommission; // Admin commission deducted since cash was collected
                await wallet.save();
                console.log("Wallet updated.");
            }
        }

        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

fixBooking();
