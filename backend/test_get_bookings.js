const Booking = require('./models/Booking');
const User = require('./models/User');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function test() {
    try {
        const Provider = require('./models/Provider');
        const provider = await Provider.findOne({});
        if (!provider) {
            console.log("No providers found to test.");
            mongoose.disconnect();
            return;
        }
        console.log(`Testing with Provider ID: ${provider._id} (${provider.ownerName})`);
        
        const bookings = await Booking.find({ providerId: provider._id })
            .populate('userId', 'ownerName name mobile address')
            .sort({ createdAt: -1 });
            
        console.log(`Found ${bookings.length} bookings.`);
        console.log("Bookings:", bookings);
        mongoose.disconnect();
    } catch (err) {
        console.error("ERROR CAUGHT:", err);
        mongoose.disconnect();
    }
}
test();
