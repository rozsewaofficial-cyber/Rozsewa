require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const ProviderSubscription = require('./models/ProviderSubscription');
    await ProviderSubscription.updateMany({ pricePaid: { $exists: false } }, { $set: { pricePaid: 999 } });
    console.log('Fixed subscriptions');
    process.exit(0);
});
