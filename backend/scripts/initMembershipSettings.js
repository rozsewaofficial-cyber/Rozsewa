const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Setting = require('../models/Setting');

const initSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB...');

        const sets = [
            { key: 'vendorCardEnabled', value: true },
            { key: 'vendorCardPrice', value: 99 }
        ];

        for (const s of sets) {
            await Setting.findOneAndUpdate(
                { key: s.key },
                { value: s.value },
                { upsert: true, new: true }
            );
            console.log(`Setting initialized: ${s.key} = ${s.value}`);
        }

        console.log('Membership settings initialized successfully!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

initSettings();
