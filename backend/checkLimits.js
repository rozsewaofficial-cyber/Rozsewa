const mongoose = require('mongoose');
const Setting = require('./models/Setting');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const config = await Setting.findOne({ key: 'cash_limits_config' });
        if (config) {
            config.value.defaultLimit = 500;
            // Clear category/service limits for now so default applies to all, or set them to 500
            config.value.categoryLimits = [];
            config.value.serviceLimits = [];
            config.markModified('value');
            await config.save();
            console.log("Updated config to 500:", config.value);
        } else {
            console.log("Config not found");
        }
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
