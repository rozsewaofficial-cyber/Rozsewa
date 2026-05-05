const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const resetBoth = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        const bcrypt = require('bcryptjs');
        const emails = ['admin@rozsewa.com', 'admin@gmail.com', 'xyz@gmail.com'];
        
        for (const email of emails) {
            const user = await User.findOne({ email });
            if (user) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash('pass-admin123', salt);
                await user.save();
                console.log(`Reset password for ${email} (Manually Hashed)`);
            } else {
                console.log(`User ${email} not found`);
            }
        }

        console.log('Admin passwords reset to pass-admin123 (Manual Hash Success)');
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetBoth();
