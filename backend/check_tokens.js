require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const p = await Provider.findById('6a229c9b5f24453f9f05af8e');
    console.log('Provider Shop:', p.shopName);
    console.log('FCM Tokens:', p.fcmTokens);
    console.log('FCM Mobile:', p.fcmTokenMobile);
    process.exit(0);
}
run();
