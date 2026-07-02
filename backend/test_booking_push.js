require('dotenv').config();
const mongoose = require('mongoose');
const { notifyUser } = require('./config/notificationService');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    
    const providerId = '6a229c9b5f24453f9f05af8e'; // from user logs
    
    // Send Booking Request exactly as it is sent in bookingController.js
    console.log('Sending Booking Request to Provider: ' + providerId);
    await notifyUser({
        userId: providerId,
        userRole: 'provider',
        title: 'Urgent: Service Request!',
        message: 'You received a new request for AC Repair. Accept now!',
        type: 'booking',
        bookingId: 'test_bk_' + Date.now(), // Random booking ID to prevent duplicate block
        data: {
            link: `/provider/bookings`
        }
    });
    
    console.log('Done');
    process.exit(0);
}
run();
