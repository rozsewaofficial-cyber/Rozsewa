require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const nameFromClient = "Plumber's ";
    const cat = await Category.findOne({ name: { $regex: new RegExp('^' + nameFromClient.trim() + '$', 'i') } });
    console.log(cat ? 'FOUND' : 'NOT FOUND');
    process.exit();
}).catch(console.error);
