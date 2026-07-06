require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const { Wallet } = require('./models/Wallet');

async function fixWallets() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Wallet.updateMany(
            { balance: 250, userId: { $exists: true } }, 
            { $set: { balance: 0 } }
        );
        
        console.log(`Successfully reset ${result.modifiedCount} user wallets from 250 to 0.`);
    } catch (err) {
        console.error('Error fixing wallets:', err);
    } finally {
        mongoose.disconnect();
    }
}

fixWallets();
