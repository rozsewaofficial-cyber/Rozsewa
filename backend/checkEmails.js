const mongoose = require('mongoose');
const Provider = require('./models/Provider');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rozsewa').then(async () => {
    const total = await Provider.countDocuments();
    const withEmail = await Provider.countDocuments({ email: { $exists: true, $ne: null, $ne: "" } });
    console.log(`Providers with email: ${withEmail} out of ${total}`);
    
    // Also check pending bookings and if their provider has an email
    const Booking = require('./models/Booking');
    const bookings = await Booking.find({ status: 'pending' }).limit(5);
    console.log(`Pending bookings found: ${bookings.length}`);
    for (const b of bookings) {
       console.log(`Booking ${b._id} userId: ${b.userId}`);
    }
    
    process.exit(0);
}).catch(console.error);
