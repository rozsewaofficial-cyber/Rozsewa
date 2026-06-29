const mongoose = require('mongoose');
const Booking = require('./backend/models/Booking');

mongoose.connect('mongodb://127.0.0.1:27017/rozsewa').then(async () => {
    const bookings = await Booking.find().limit(5);
    console.log('Bookings:', bookings.map(b => ({
        id: b._id,
        userId: b.userId,
        status: b.status
    })));
    process.exit(0);
}).catch(console.error);
