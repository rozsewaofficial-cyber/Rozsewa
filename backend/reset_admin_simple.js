const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const resetAdminSimple = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        const admin = await User.findOne({ email: 'admin@rozsewa.com' });
        if (admin) {
            admin.password = '123456';
            await admin.save();
            console.log('Admin password reset successfully to: 123456');
        } else {
            console.log('Admin user not found. Creating new one...');
            await User.create({
                name: 'Super Admin',
                email: 'admin@rozsewa.com',
                mobile: '9999999999',
                password: '123456',
                role: 'superadmin',
                city: 'Delhi',
                state: 'Delhi'
            });
            console.log('Admin created successfully!');
        }

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetAdminSimple();
