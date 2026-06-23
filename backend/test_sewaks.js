require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const sewaks = await Provider.find({ providerCategory: 'sewak' });
    console.log("Sewaks count:", sewaks.length);
    sewaks.forEach(s => {
        console.log(`- ${s.shopName} (ID: ${s._id}) | verified: ${s.status === 'verified'} | online: ${s.isOnline} | loc: ${!!(s.location && s.location.coordinates)}`);
    });
    process.exit();
}).catch(console.error);
