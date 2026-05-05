const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Provider = require('../models/Provider');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedTestSewak = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected for seeding...');

        const mobile = '9999900000';
        const password = '123456';

        // Check if provider exists
        let provider = await Provider.findOne({ mobile });

        const testData = {
            ownerName: 'Test Sewak',
            shopName: 'Sewak Testing Store',
            mobile: mobile,
            password: password, // Will be hashed by pre-save hook
            address: '123 Test Street',
            city: 'Agra',
            state: 'Uttar Pradesh',
            providerCategory: 'sewak',
            status: 'verified',
            kycVerified: true,
            isOnline: true,
            vendorCode: 'RSVND99999'
        };

        if (provider) {
            console.log('Test Sewak already exists. Updating credentials...');
            provider.password = password;
            provider.ownerName = testData.ownerName;
            provider.shopName = testData.shopName;
            provider.address = testData.address;
            provider.city = testData.city;
            provider.state = testData.state;
            provider.providerCategory = testData.providerCategory;
            provider.status = testData.status;
            provider.kycVerified = testData.kycVerified;
            await provider.save();
            console.log('Test Sewak updated successfully.');
        } else {
            console.log('Creating new Test Sewak...');
            provider = new Provider(testData);
            await provider.save();
            console.log('Test Sewak created successfully.');
        }

        process.exit(0);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedTestSewak();
