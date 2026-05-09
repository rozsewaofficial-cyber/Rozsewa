const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('./models/Category');

dotenv.config();

const testSave = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const category = await Category.findOne({ name: 'Health & Wellness' });
        if (!category) {
            console.log('Category not found');
            process.exit(1);
        }

        console.log('Found category:', category.name);

        // Simulate frontend update
        const updatedServices = category.services.map(s => {
            if (s.name === 'Home Nurse') {
                return { ...s.toObject(), sewakPriceBasic: 1200 };
            }
            return s.toObject();
        });

        // Use the same logic as adminController
        category.services = [];
        category.services.push(...updatedServices);
        category.markModified('services');

        const updated = await category.save();
        console.log('Saved category. New services:', JSON.stringify(updated.services, null, 2));

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

testSave();
