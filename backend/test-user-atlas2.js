require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const users = await User.find({ addresses: { $ne: [] } });
    for (let u of users) {
        console.log(JSON.stringify(u.addresses, null, 2));
    }
    process.exit();
});
