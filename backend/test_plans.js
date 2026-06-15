const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    try {
        const Provider = require('./models/Provider');
        const Category = require('./models/Category');
        const SubscriptionPlan = require('./models/SubscriptionPlan');

        const provider = await Provider.findOne({ mobile: '8643041429' });
        console.log('Provider vendorType:', provider.vendorType, typeof provider.vendorType);

        let catId = null;
        if (provider.vendorType) {
            if (mongoose.Types.ObjectId.isValid(provider.vendorType)) {
                catId = provider.vendorType;
            } else {
                const cat = await Category.findOne({ name: new RegExp('^' + provider.vendorType + '$', 'i') });
                if (cat) catId = cat._id;
            }
        }
        
        console.log('Resolved catId:', catId, typeof catId);

        const queryOr = [
            { category: { $exists: false } },
            { category: null },
            { category: "" }
        ];
        if (catId) {
            queryOr.push({ category: catId });
        }
        
        console.log('queryOr:', JSON.stringify(queryOr, null, 2));

        const plans = await SubscriptionPlan.find({ 
            isActive: true, 
            $or: queryOr
        });

        console.log('Returned plans:', plans.length);
        console.log(plans);
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}).catch(console.error);
