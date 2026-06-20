require('dotenv').config({path: __dirname + '/.env'});
const mongoose = require('mongoose');

async function getProviderTransactions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { Transaction } = require('./models/Wallet');
        
        const txs = await Transaction.find({ providerId: '6a229c9b5f24453f9f05af8e' }).sort({ createdAt: 1 });
        
        let calculatedAvailableBalance = 0;
        let calculatedCashDues = 0;

        for (let tx of txs) {
            console.log(`[${tx.type}] ${tx.amount} - ${tx.title}`);
            if (tx.title.startsWith('Service Earnings')) {
                calculatedAvailableBalance += tx.amount;
            } else if (tx.title.startsWith('Commission Deducted')) {
                calculatedCashDues -= tx.amount;
            } else if (tx.title.startsWith('Withdrawal') && tx.status !== 'rejected') {
                calculatedAvailableBalance -= tx.amount;
            } else if (tx.type === 'debit') {
                // Unknown debit, maybe manual? Assume it subtracts from availableBalance
                calculatedAvailableBalance -= tx.amount;
            } else if (tx.type === 'credit') {
                calculatedAvailableBalance += tx.amount;
            }
        }
        
        console.log(`\nCalculated Available Balance: ${calculatedAvailableBalance}`);
        console.log(`Calculated Cash Dues (balance): ${calculatedCashDues}`);
        
        process.exit(0);
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
}
getProviderTransactions();
