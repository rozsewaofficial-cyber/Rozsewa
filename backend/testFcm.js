require('dotenv').config();
const { sendNotificationToUser } = require('./config/notificationService');
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

async function testPush() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const provider = await Provider.findById('6a229c9b5f24453f9f05af8e');
    if (!provider) {
        console.log("No provider found.");
    } else {
        console.log("Found provider:", provider.ownerName, "ID:", provider._id);
        console.log("Tokens:", provider.fcmTokens);
        
        await sendNotificationToUser(provider._id, 'provider', {
            title: 'Test Notification',
            body: 'This is a test notification from the backend script.',
            data: { type: 'test' }
        }, true);
        console.log("Sent notification.");
    }
    
    mongoose.disconnect();
}

testPush().catch(console.error);
