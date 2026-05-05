const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const supervisors = await User.find({ role: 'supervisor' });
        console.log('Supervisors Found:', supervisors.length);
        supervisors.forEach(s => {
            console.log(`Email: ${s.email}, Pass: ${s.password.substring(0, 10)}... Hashed: ${s.password.startsWith('$2')}`);
        });
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

debug();
