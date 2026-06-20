require('dotenv').config({path: __dirname + '/.env'});
const mongoose = require('mongoose');

async function checkWallet() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { Wallet, Transaction } = require('./models/Wallet');
        
        // The booking is ab743b. Let's find the transaction and the wallet.
        const tx = await Transaction.findOne({ bookingId: '6a3635495906b3fb00ab743b' });
        if (tx) {
            console.log("Transaction:", tx);
            const wallet = await Wallet.findOne({ providerId: tx.providerId });
            console.log("Wallet:", wallet);
        } else {
            console.log("Transaction not found for ab743b!");
            const Booking = require('./models/Booking');
            const b = await Booking.findById('6a3635495906b3fb00ab743b');
            if (b) {
                const wallet = await Wallet.findOne({ providerId: b.providerId });
                console.log("Wallet:", wallet);
            }
        }
        process.exit(0);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}
checkWallet();
