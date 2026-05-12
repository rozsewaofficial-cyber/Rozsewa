const admin = require('firebase-admin');
const serviceAccount = require('./rozsewa.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
