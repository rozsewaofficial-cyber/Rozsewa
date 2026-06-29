require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./models/Setting');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const config = await Setting.findOne({ key: 'distance_charge_config' });
    console.log(JSON.stringify(config, null, 2));
    mongoose.connection.close();
});
