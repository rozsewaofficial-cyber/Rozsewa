const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

dotenv.config();

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        const email = 'admin@rozsewa.com';
        const passwordInput = 'pass-admin123';

        const user = await User.findOne({ email });
        if (!user) {
            console.log('User NOT found');
        } else {
            console.log('User found:', user.email);
            const isMatch = await user.matchPassword(passwordInput);
            console.log('Password match:', isMatch);
            console.log('Stored hash:', user.password);

            // Re-hash and test again
            const salt = await bcrypt.genSalt(10);
            const newHash = await bcrypt.hash(passwordInput, salt);
            console.log('New hash generated:', newHash);
            const matchOldHashWithNewInput = await bcrypt.compare(passwordInput, user.password);
            console.log('Compare manual match:', matchOldHashWithNewInput);
        }

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

testLogin();
