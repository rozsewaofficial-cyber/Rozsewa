require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const { Wallet } = require('./models/Wallet');
    await Wallet.updateMany({ balance: { $lt: 0 } }, { $set: { balance: 0, availableBalance: 0 } });
    console.log('Fixed wallet balances');
    process.exit(0);
});
