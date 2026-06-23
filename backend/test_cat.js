require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/rozsewa")
    .then(async () => {
        const categories = await Category.find();
        console.log("Categories:", categories.map(c => c.name));
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
