const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const Booking = require('./models/Booking');

async function run() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');
        
        // Fetch all pending bookings
        const bookings = await Booking.find({ status: 'pending' });
        console.log(`Found ${bookings.length} pending bookings.`);
        
        if (bookings.length > 0) {
            for (const b of bookings) {
                console.log('Cancelling booking:', b._id);
                b.status = 'cancelled';
                await b.save();
            }
            console.log('All pending bookings cancelled successfully!');
        } else {
            console.log('No pending bookings found.');
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
run();
