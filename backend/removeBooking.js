require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

async function removeBooking() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const targetSuffix = 'adcf41'.toLowerCase();

        // Find all bookings and filter by ID string
        const allBookings = await Booking.find({}, { _id: 1 });
        const matchingBooking = allBookings.find(b => b._id.toString().toLowerCase().endsWith(targetSuffix) || b._id.toString().toLowerCase().includes(targetSuffix));

        if (!matchingBooking) {
            console.log(`No booking found containing '${targetSuffix}' in its ID.`);
        } else {
            console.log(`Found booking with ID: ${matchingBooking._id}`);
            const result = await Booking.findByIdAndDelete(matchingBooking._id);
            if (result) {
                console.log(`Successfully deleted booking: ${matchingBooking._id}`);
            } else {
                console.log('Failed to delete booking.');
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

removeBooking();
