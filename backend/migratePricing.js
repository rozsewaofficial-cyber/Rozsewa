const mongoose = require('mongoose');
const Service = require('./models/Service');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/Rojsewa";

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log("Connected to MongoDB for migration");
        
        try {
            // Find all services that have a pricing.basic field
            const services = await Service.find({ 'pricing.basic': { $exists: true } });
            console.log(`Found ${services.length} services to migrate.`);
            
            let updatedCount = 0;
            for (let service of services) {
                // If the service doesn't have a price field yet, or if it does, override it
                const basicPrice = service.get('pricing.basic');
                if (basicPrice !== undefined && basicPrice !== null) {
                    service.price = basicPrice;
                    // Mongoose might complain if we try to unset something required by old schema but we updated the schema.
                    // To be safe, we'll use collection.updateOne
                    await Service.collection.updateOne(
                        { _id: service._id },
                        { 
                            $set: { price: basicPrice },
                            $unset: { pricing: "" }
                        }
                    );
                    updatedCount++;
                }
            }
            
            console.log(`Migration complete. Updated ${updatedCount} services.`);
        } catch (error) {
            console.error("Migration error:", error);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => console.error("Could not connect to MongoDB", err));
