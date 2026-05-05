const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Provider = require('./models/Provider');
const Category = require('./models/Category');

dotenv.config();

const migrateSewaks = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const sewaks = await Provider.find({ providerCategory: 'sewak', vendorType: null });
        console.log(`Found ${sewaks.length} Sewaks with missing vendorType`);

        for (const sewak of sewaks) {
            const category = await Category.findOne({ name: sewak.businessType });
            if (category) {
                sewak.vendorType = category._id;
                await sewak.save();
                console.log(`Updated Sewak ${sewak.ownerName} with category ${category.name}`);
            } else {
                console.warn(`Category not found for ${sewak.businessType} (Sewak: ${sewak.ownerName})`);
            }
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

migrateSewaks();
