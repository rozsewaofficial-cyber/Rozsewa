const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected to seed admin...');

        const adminExists = await User.findOne({ email: 'admin@rozsewa.com' });
        if (adminExists) {
            adminExists.role = 'superadmin';
            adminExists.password = 'pass-admin123';
            adminExists.city = 'Delhi';
            adminExists.state = 'Delhi';
            await adminExists.save();
            console.log('Admin updated to Super Admin!');
            process.exit();
        }

        const admin = await User.create({
            name: 'Super Admin',
            email: 'admin@rozsewa.com',
            mobile: '9999999999',
            password: 'pass-admin123',
            role: 'superadmin',
            city: 'Delhi',
            state: 'Delhi',
        });

        console.log('Admin Created Successfully!');
        console.log('Email: admin@rozsewa.com');
        console.log('Pass: pass-admin123');
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
