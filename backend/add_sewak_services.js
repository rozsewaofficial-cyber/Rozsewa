const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Provider = require('./models/Provider');
const Category = require('./models/Category');
const Service = require('./models/Service');

dotenv.config();

const addServicesToExistingSewaks = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const sewaks = await Provider.find({ providerCategory: 'sewak' });
        console.log(`Found ${sewaks.length} Sewaks`);

        for (const sewak of sewaks) {
            const category = await Category.findById(sewak.vendorType);
            if (category && category.services) {
                console.log(`Checking services for Sewak: ${sewak.ownerName} in category: ${category.name}`);

                for (const masterSvc of category.services) {
                    const exists = await Service.findOne({ providerId: sewak._id, name: masterSvc.name });
                    if (!exists) {
                        await Service.create({
                            providerId: sewak._id,
                            name: masterSvc.name,
                            description: masterSvc.description,
                            category: category.name,
                            pricing: {
                                basic: masterSvc.sewakPriceBasic || masterSvc.basePrice || 299,
                                standard: masterSvc.sewakPriceStandard || 0,
                                premium: masterSvc.sewakPricePremium || 0,
                                express: masterSvc.sewakPriceExpress || 0
                            },
                            visible: true
                        });
                        console.log(`Added service ${masterSvc.name} to ${sewak.ownerName}`);
                    }
                }
            }
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

addServicesToExistingSewaks();
