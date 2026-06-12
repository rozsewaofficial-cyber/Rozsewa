const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Provider = require('./models/Provider');

mongoose.connect('mongodb://127.0.0.1:27017/rojsewa')
    .then(async () => {
        // find a sewak
        const sewak = await Provider.findOne({});
        if (!sewak) {
            console.log("No sewak found");
            process.exit();
        }

        console.log("Current pass hash:", sewak.password);
        
        // update pass
        sewak.password = "newPass123";
        await sewak.save();
        
        console.log("Saved pass hash:", sewak.password);

        // test comparison
        const match = await sewak.matchPassword("newPass123");
        console.log("Match with 'newPass123':", match);
        
        process.exit();
    });
