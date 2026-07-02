const mongoose = require('mongoose');
const Provider = require('./models/Provider');
const Category = require('./models/Category');
const { Wallet } = require('./models/Wallet');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function check() {
  try {
    const category = await Category.findOne({ name: /Lead Category/i });
    console.log("=== Category ===");
    if (!category) {
      console.log("No 'Lead Category' found.");
    } else {
      console.log(`ID: ${category._id}`);
      console.log(`Name: ${category.name}`);
      console.log(`Business Model: ${category.businessModel}`);
      console.log(`requiresSubscription: ${category.requiresSubscription}`);
    }

    console.log("\n=== Providers info ===");
    const providers = await Provider.find({ status: 'verified', isOnline: true });
    for (const p of providers) {
      if (String(p.vendorType) !== String(category._id)) continue;
      console.log(`Shop: ${p.shopName} | ID: ${p._id}`);
      console.log(`  vendorType: ${p.vendorType} (Match: true)`);
      console.log(`  providerType: ${p.providerType}`);
      console.log(`  canReceiveLead: ${p.canReceiveLead}`);
      console.log(`  location:`, p.location);
      
      const wallet = await Wallet.findOne({ providerId: p._id });
      console.log(`  wallet balance: ${wallet ? wallet.availableBalance : 'N/A'}`);
      console.log(`  isSubscribed: ${p.isSubscribed}`);
    }
    
    mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
check();
