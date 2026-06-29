const mongoose = require('mongoose');
const Booking = require('./models/Booking');
const Provider = require('./models/Provider');

mongoose.connect('mongodb://localhost:27017/rozsewa').then(async () => {
    const b = await Booking.findOne().sort({createdAt: -1});
    const p = await Provider.findById(b.providerId || b.counterOffers[0]?.providerId || b.rejectedBy[0] || (await Provider.findOne())._id);
    console.log("Booking coords:", b.location.coordinates);
    console.log("Provider coords:", p.location.coordinates);
    process.exit();
});
