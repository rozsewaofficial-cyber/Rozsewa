const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Booking = require('./models/Booking');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const booking = await Booking.findById('6a436ee3a1938a28aefb62e0');
        console.log(JSON.stringify(booking, null, 2));
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

run();
