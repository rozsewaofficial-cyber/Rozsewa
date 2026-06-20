require('dotenv').config({path: __dirname + '/.env'});
const mongoose = require('mongoose');

async function convertToCash() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { Wallet, Transaction } = require('./models/Wallet');
        const Booking = require('./models/Booking');
        
        const booking = await Booking.findById('6a3635495906b3fb00ab743b');
        if (!booking) return console.log("Booking not found");

        const tx = await Transaction.findOne({ bookingId: booking._id });
        if (!tx) return console.log("Transaction not found");

        if (tx.type === 'debit') {
            console.log("Already converted to cash!");
            process.exit(0);
        }

        // Reverse the credit to availableBalance
        const wallet = await Wallet.findOne({ providerId: booking.providerId });
        if (wallet) {
            wallet.availableBalance -= 777.4; // Reverse provider payout
            wallet.balance -= 67.6; // Add admin commission dues
            await wallet.save();
        }

        // Update transaction
        tx.amount = 67.6;
        tx.type = 'debit';
        tx.title = `Commission Deducted: ${booking.serviceName}`;
        await tx.save();

        // Update booking
        booking.paymentMode = 'after'; // Cash
        booking.paymentStatus = 'pending'; // Cash payments are pending until Admin gets their dues
        await booking.save();

        console.log("Converted successfully!");
        process.exit(0);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}
convertToCash();
