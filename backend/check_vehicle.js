const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('./models/Category');

dotenv.config();

const checkVehicleServices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const cat = await Category.findOne({ name: 'Vehicle Services' });
        console.log('Vehicle Services SubServices:', JSON.stringify(cat.subServices, null, 2));
        process.exit();
    } catch (err) {
        process.exit(1);
    }
};

checkVehicleServices();
