const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/rozsewa').then(async () => {
    const u = await User.findOne({ addresses: { $ne: [] } });
    if(u) {
        console.log(JSON.stringify(u.addresses, null, 2));
    }
    process.exit();
});
