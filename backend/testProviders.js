const mongoose = require('mongoose');
const Provider = require('./models/Provider');

async function test() {
  await mongoose.connect('mongodb://aryanpathak0421_db_user:aBFXgQmFTAkGe83t@ac-yd6zly6-shard-00-00.ls4efop.mongodb.net:27017,ac-yd6zly6-shard-00-01.ls4efop.mongodb.net:27017,ac-yd6zly6-shard-00-02.ls4efop.mongodb.net:27017/rojsewaa?ssl=true&replicaSet=atlas-pxm6g1-shard-0&authSource=admin&retryWrites=true&w=majority');
  
  const providers = await Provider.find({ shopName: { $in: ['Slab Shop', 'Verify Provi'] } }).select('shopName city location');
  providers.forEach(p => console.log(JSON.stringify(p, null, 2)));
  
  process.exit(0);
}
test();
