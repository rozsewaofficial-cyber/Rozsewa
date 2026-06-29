require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const providers = await Provider.find({}).limit(5).select('name shopName location');
    console.log(JSON.stringify(providers, null, 2));
    mongoose.connection.close();
});
