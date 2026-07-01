const mongoose = require('mongoose');
require('./models/User');
require('./models/BazaarAd');
const BazaarOffer = require('./models/BazaarOffer');

async function test() {
  await mongoose.connect('mongodb://aryanpathak0421_db_user:aBFXgQmFTAkGe83t@ac-yd6zly6-shard-00-00.ls4efop.mongodb.net:27017,ac-yd6zly6-shard-00-01.ls4efop.mongodb.net:27017,ac-yd6zly6-shard-00-02.ls4efop.mongodb.net:27017/rojsewaa?ssl=true&replicaSet=atlas-pxm6g1-shard-0&authSource=admin&retryWrites=true&w=majority');
  
  const offers = await BazaarOffer.find().populate('adId', 'title price');
  offers.forEach(o => console.log(`Offer ID: ${o._id} - Amount: ${o.currentOfferAmount} - Ad Price: ${o.adId?.price} - Ad Title: ${o.adId?.title}`));
  
  process.exit(0);
}
test();
