const mongoose = require('mongoose');
const Provider = require('./models/Provider');
const { Wallet } = require('./models/Wallet');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

async function run() {
  try {
    // Update abc industries
    const p1 = await Provider.findOneAndUpdate(
      { shopName: "abc industries" },
      { providerType: "both", isOnline: true, canReceiveLead: true },
      { new: true }
    );
    console.log("Updated abc industries:", p1?.shopName, "providerType:", p1?.providerType);

    // Update Test Lead Provider
    const p2 = await Provider.findOneAndUpdate(
      { shopName: "Test Lead Provider" },
      { providerType: "both", isOnline: true, canReceiveLead: true },
      { new: true }
    );
    console.log("Updated Test Lead Provider:", p2?.shopName, "providerType:", p2?.providerType);

    if (p2) {
      const w = await Wallet.findOneAndUpdate(
        { providerId: p2._id },
        { availableBalance: 1000, balance: 1000 },
        { upsert: true, new: true }
      );
      console.log("Updated Test Lead Provider Wallet Balance to:", w.availableBalance);
    }

    mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}
run();
