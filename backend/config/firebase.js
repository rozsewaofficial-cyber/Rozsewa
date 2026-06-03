const admin = require('firebase-admin');

let serviceAccount;

try {
    // Try to load from environment variable first (for production/Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
    } else {
        // Fallback to local file for development
        serviceAccount = require('./rozsewa.json');
    }
} catch (error) {
    console.error('Error loading Firebase service account:', error);
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin Initialized Successfully');
} else {
    console.warn('Firebase admin not initialized: No service account found');
}

module.exports = admin;
