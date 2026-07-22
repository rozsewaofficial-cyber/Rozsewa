const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Setting = require('../models/Setting');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const initCommissions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        const settings = [
            { key: 'commission_basic', value: '25', description: 'Commission rate for Basic plan (%)' },
            { key: 'commission_standard', value: '20', description: 'Commission rate for Standard plan (%)' },
            { key: 'commission_premium', value: '15', description: 'Commission rate for Premium plan (%)' },
            { key: 'subscription_enabled', value: 'true', description: 'Enable subscription discounts' }
        ];

        for (const s of settings) {
            await Setting.findOneAndUpdate(
                { key: s.key },
                { $set: s },
                { upsert: true, new: true }
            );
            console.log(`Updated setting: ${s.key}`);
        }

        // Initialize a 999 Subscription Plan
        const defaultPlan = {
            name: 'Elite Provider Subscription',
            price: 999,
            validityDays: 365,
            offeredCommissionRate: 5,
            offeredCommissionType: 'percentage',
            description: 'Get a flat 5% commission on all bookings for a full year!',
            isActive: true
        };

        await SubscriptionPlan.findOneAndUpdate(
            { name: defaultPlan.name },
            { $set: defaultPlan },
            { upsert: true, new: true }
        );
        console.log('Subscription Plan initialized.');

        console.log('Commission settings initialized successfully!');
        process.exit();
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
};

initCommissions();
