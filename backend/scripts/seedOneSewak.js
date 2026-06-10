const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Provider = require('../models/Provider');
const OTP = require('../models/OTP');

const MOBILE   = '9999911111';
const PASSWORD = 'password123';
const OTP_CODE = '123456';

const run = async () => {
    try {
        console.log('\n🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected!\n');

        // ── 1. Upsert Provider ──────────────────────────────────────────────
        let provider = await Provider.findOne({ mobile: MOBILE });

        const providerData = {
            ownerName:        'Test Sewak',
            shopName:         'Test Sewak Store',
            mobile:           MOBILE,
            password:         PASSWORD,          // hashed by pre-save hook
            address:          '123 Test Street',
            city:             'Agra',
            state:            'Uttar Pradesh',
            providerCategory: 'sewak',
            status:           'verified',
            kycVerified:      true,
            isOnline:         true,
            vendorCode:       'RSSEWK11111',
            freeServicesLeft: 5,
            planType:         'basic',
            isSubscribed:     false,
            commissionRate:   10,
            location: { type: 'Point', coordinates: [78.0081, 27.1767] },
        };

        if (provider) {
            // Re-set password so it gets re-hashed
            provider.password         = PASSWORD;
            provider.providerCategory = 'sewak';
            provider.status           = 'verified';
            provider.kycVerified      = true;
            await provider.save();
            console.log('🔄 Provider already existed — credentials reset.');
        } else {
            provider = new Provider(providerData);
            await provider.save();
            console.log('✨ Sewak Provider created successfully.');
        }

        // ── 2. Seed OTP (delete old + insert fresh with long expiry) ────────
        await OTP.deleteMany({ mobile: MOBILE });

        // Override the TTL by setting createdAt far in future
        await OTP.collection.insertOne({
            mobile:    MOBILE,
            otp:       OTP_CODE,
            createdAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // expires in ~24 hrs
        });
        console.log('🔑 OTP seeded successfully.\n');

        // ── Summary ──────────────────────────────────────────────────────────
        console.log('═══════════════════════════════════════');
        console.log('  SEWAK SEED — LOGIN CREDENTIALS');
        console.log('═══════════════════════════════════════');
        console.log(`  Mobile   : ${MOBILE}`);
        console.log(`  Password : ${PASSWORD}`);
        console.log(`  OTP      : ${OTP_CODE}`);
        console.log(`  Status   : verified`);
        console.log(`  Category : sewak`);
        console.log('═══════════════════════════════════════\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

run();
