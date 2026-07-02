const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Provider = require('./models/Provider');
    try {
        // Zirakpur, Punjab coordinates
        await Provider.updateMany(
            { shopName: { $regex: 'Prince Pandey', $options: 'i' } },
            { location: { type: 'Point', coordinates: [76.8226, 30.6425] } }
        );

        // Buxar, Bihar coordinates
        await Provider.updateMany(
            { shopName: { $regex: 'satyam kumar', $options: 'i' } },
            { location: { type: 'Point', coordinates: [83.9808, 25.5647] } }
        );
        await Provider.updateMany(
            { shopName: { $regex: '^Prince$', $options: 'i' } },
            { location: { type: 'Point', coordinates: [83.9808, 25.5647] } }
        );

        // Trial Shop -> Delhi coordinates
        await Provider.updateMany(
            { shopName: { $regex: 'Trial Shop', $options: 'i' } },
            { location: { type: 'Point', coordinates: [77.2090, 28.6139] } }
        );

        console.log('Successfully updated locations for test providers to their respective states (Punjab, Bihar, Delhi).');
    } catch(err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
});
