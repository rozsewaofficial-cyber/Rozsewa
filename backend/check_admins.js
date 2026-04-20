const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

const checkAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB...');
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
        console.log(`Found ${admins.length} admins in DB:`);
        admins.forEach(a => {
            console.log(`- ${a.name} (${a.email}) - Role: ${a.role}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkAdmins();
