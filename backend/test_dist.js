require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    // Let's use the coordinates from my last run
    // Sewak: [75.87196731803874,22.717599403198935]
    // Booking: [75.87194537389489,22.717612047580733]
    
    const radiusInKm = 10;
    const radiusInRadians = radiusInKm / 6371;

    const providersToNotify = await Provider.find({
        status: 'verified',
        isOnline: true,
        providerCategory: 'sewak',
        location: {
            $geoWithin: {
                $centerSphere: [[75.87194537389489,22.717612047580733], radiusInRadians]
            }
        }
    });

    console.log("Providers found via geoWithin:", providersToNotify.length);
    process.exit();
}).catch(console.error);
