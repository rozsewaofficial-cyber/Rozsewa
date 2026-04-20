const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ email: 'admin@rozsewa.com' });
        if (user) {
            console.log('Role:', user.role);
            console.log('Permissions:', user.permissions);
        } else {
            console.log('User not found');
        }
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

check();
