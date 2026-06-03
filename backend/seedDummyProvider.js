const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Provider = require('./models/Provider');

dotenv.config();

const seedDummyProvider = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const dummyProvider = {
            mobile: '9999999999',
            password: 'password123',
            ownerName: 'Dummy Owner',
            shopName: 'Dummy Shop',
            businessType: 'service',
            vendorCode: 'RSVND99999',
            address: '123 Dummy Street',
            city: 'Dummy City',
            state: 'Dummy State',
            status: 'verified',
            freeServicesLeft: 5,
            isSubscribed: false
        };

        const existingProvider = await Provider.findOne({ mobile: dummyProvider.mobile });
        if (existingProvider) {
            console.log('Dummy provider already exists with mobile:', dummyProvider.mobile);
            process.exit(0);
        }

        const provider = await Provider.create(dummyProvider);
        console.log('Dummy Provider Seeded Successfully:', provider.mobile);
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding provider:', error);
        process.exit(1);
    }
};

seedDummyProvider();
