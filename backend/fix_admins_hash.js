const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

dotenv.config();

const fixAdminsHash = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('pass-admin123', salt);

        await User.updateOne({ email: 'admin@rozsewa.com' }, { password: hash });
        await User.updateOne({ email: 'admin@gmail.com' }, { password: hash });

        console.log('Admins fixed with proper bcrypt hashes.');
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixAdminsHash();
