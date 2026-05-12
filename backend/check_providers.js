const Provider = require('./models/Provider');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
    try {
        const provider = await Provider.findOne({ shopName: "KK Industries" });
        if (!provider) {
            console.log("Provider 'KK Industries' NOT FOUND in database.");
            const all = await Provider.find({}).select('shopName ownerName status isOnline');
            console.log("\nAll Providers in DB:");
            all.forEach(p => console.log(`Shop: ${p.shopName}, Owner: ${p.ownerName}, Status: ${p.status}, Online: ${p.isOnline}`));
        } else {
            console.log("Provider FOUND:");
            console.log(`ID: ${provider._id}`);
            console.log(`Shop Name: ${provider.shopName}`);
            console.log(`Status: ${provider.status}`);
            console.log(`IsOnline: ${provider.isOnline}`);
            console.log(`Location:`, provider.location);
            console.log(`City: ${provider.city}`);
        }
        mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}
check();
