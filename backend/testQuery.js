const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Provider = require('./models/Provider');
    try {
        const providers = await Provider.find({ shopName: { $regex: 'Prince Pandey|Trial Shop|satyam kumar', $options: 'i' } }).select('shopName vendorCode address location');
        console.log(JSON.stringify(providers, null, 2));
    } catch(err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
});
