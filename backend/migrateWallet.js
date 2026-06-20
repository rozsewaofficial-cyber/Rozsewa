require('dotenv').config({path: __dirname + '/.env'});
const mongoose = require('mongoose');

async function migrateWalletBalances() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { Wallet } = require('./models/Wallet');
        
        const wallets = await Wallet.find({});
        for (let wallet of wallets) {
            // In the old system, a positive balance meant withdrawable funds.
            // In the new system, withdrawable funds are in availableBalance,
            // and balance is used purely for tracking cash commission dues (negative).
            
            if (wallet.balance > 0) {
                console.log(`Migrating wallet ${wallet._id}: moving ${wallet.balance} to availableBalance`);
                wallet.availableBalance = (wallet.availableBalance || 0) + wallet.balance;
                wallet.balance = 0;
                await wallet.save();
            }
        }
        
        console.log("Migration complete.");
        process.exit(0);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}

migrateWalletBalances();
