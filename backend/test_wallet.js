require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');
const { Wallet } = require('./models/Wallet');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const sewak = await Provider.findOne({ providerCategory: 'sewak' });
    const wallet = await Wallet.findOne({ providerId: sewak._id });
    console.log("Wallet:", wallet ? wallet.balance : "No wallet");
    process.exit();
}).catch(console.error);
