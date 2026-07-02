require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const provider = await Provider.findById('6a229c9b5f24453f9f05af8e');
    console.log('fcmTokens:', provider.fcmTokens);
    console.log('fcmTokenMobile:', provider.fcmTokenMobile);
    process.exit(0);
}
run();
