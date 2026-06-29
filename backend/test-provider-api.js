const mongoose = require('mongoose');
const Provider = require('./models/Provider');

mongoose.connect('mongodb://localhost:27017/rozsewa').then(async () => {
    const p = await Provider.findOne();
    console.log(JSON.stringify(p, null, 2));
    process.exit();
});
