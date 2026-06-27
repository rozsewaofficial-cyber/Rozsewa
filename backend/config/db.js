const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Auto-migration: Initialize wallet dashboard fields if missing
        try {
            const Provider = require('../models/Provider');
            const result = await Provider.updateMany(
                { 
                    $or: [ 
                        { pendingBalance: { $exists: false } }, 
                        { totalWithdrawn: { $exists: false } } 
                    ] 
                },
                { 
                    $set: { 
                        pendingBalance: 0, 
                        totalWithdrawn: 0 
                    } 
                }
            );
            if (result.modifiedCount > 0) {
                console.log(`[Auto-Migration] Initialized balance fields for ${result.modifiedCount} providers.`);
            }
        } catch (migErr) {
            console.error(`[Auto-Migration] Warning: Could not initialize provider fields: ${migErr.message}`);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
