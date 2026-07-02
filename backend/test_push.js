require('dotenv').config();
const mongoose = require('mongoose');
const { notifyUser } = require('./config/notificationService');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');
    
    const providerId = '6a229c9b5f24453f9f05af8e';
    
    console.log('Sending Profile Updated...');
    await notifyUser({
        userId: providerId,
        userRole: 'provider',
        title: 'Profile Updated',
        message: 'Your profile information has been successfully updated.',
        type: 'system'
    });
    
    console.log('Sending Booking Request...');
    await notifyUser({
        userId: providerId,
        userRole: 'provider',
        title: 'Urgent: Service Request!',
        message: 'You received a new request for AC Repair. Accept now!',
        type: 'booking',
        bookingId: '6a45079ef5a009f7677e6a6b',
        data: { link: '/provider/bookings' }
    });
    
    console.log('Done');
    process.exit(0);
}
run();
