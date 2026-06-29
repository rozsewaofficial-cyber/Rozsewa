require('dotenv').config();
const mongoose = require('mongoose');
const Provider = require('./models/Provider');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const p = await Provider.findOne();
    console.log(JSON.stringify(p.location, null, 2));
    process.exit();
});
