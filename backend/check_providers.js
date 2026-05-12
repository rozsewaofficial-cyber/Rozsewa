const Provider = require('./models/Provider');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const providers = await Provider.find({});
        console.log(`Total Providers: ${providers.length}`);
        providers.forEach(p => {
            console.log(`ID: ${p._id}, Name: ${p.ownerName}, Status: ${p.status}, IsOnline: ${p.isOnline}, Location:`, p.location);
        });
        mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
