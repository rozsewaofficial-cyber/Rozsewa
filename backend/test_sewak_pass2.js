const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Provider = require('./models/Provider');

mongoose.connect('mongodb://127.0.0.1:27017/rojsewa')
    .then(async () => {
        // find a sewak that is valid to avoid validation errors
        const sewak = new Provider({
            ownerName: 'Test', shopName: 'Test Shop', mobile: '9999999999', address: 'Test', city: 'Test', state: 'Test', password: 'oldPassword123'
        });
        await sewak.save();
        console.log("Initial pass hash:", sewak.password);
        
        // update pass
        sewak.password = "MyNewPassword123";
        await sewak.save();
        console.log("Saved pass hash:", sewak.password);

        // test comparison
        const match = await sewak.matchPassword("MyNewPassword123");
        console.log("Match with 'MyNewPassword123':", match);
        
        await Provider.deleteOne({ _id: sewak._id });
        process.exit();
    }).catch(err => {
        console.error(err);
        process.exit();
    });
