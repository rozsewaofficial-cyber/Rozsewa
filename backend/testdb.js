require('dotenv').config({path: 'd:/Rojsewa-main/backend/.env'});
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Booking = require('d:/Rojsewa-main/backend/models/Booking.js');
    const b = await Booking.find({}).sort({createdAt: -1}).limit(5).lean();
    for (let booking of b) {
        if (booking._id.toString().toLowerCase().endsWith('ab743b')) {
            console.log(JSON.stringify(booking, null, 2));
        }
    }
    process.exit();
}).catch(e => { console.log(e); process.exit(1); });
