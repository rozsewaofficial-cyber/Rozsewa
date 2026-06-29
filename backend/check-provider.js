const mongoose = require('mongoose');
const Provider = require('./models/Provider');

mongoose.connect('mongodb://localhost:27017/rozsewa').then(async () => {
    const p = await Provider.findOne({ location: { $exists: true } });
    console.log(p.shopName, p.location.coordinates);
    process.exit();
});
