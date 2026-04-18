const express = require('express');
const router = express.Router();
const {
    registerProvider,
    authProvider,
    getProviderProfile,
    updateProviderStatus,
    updateProviderProfile,
    getProviderStats,
    checkProviderExistence,
    uploadDocument,
    sendEmergencyAlert
} = require('../controllers/providerController');
const { getPublicCategories } = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Public routes
router.post('/register', registerProvider);
router.post('/login', authProvider);
router.post('/check-existence', checkProviderExistence);
router.get('/categories', getPublicCategories);

// Protected routes
router.get('/profile', protect, getProviderProfile);
router.put('/profile', protect, updateProviderProfile);
router.get('/stats', protect, getProviderStats);
router.patch('/status', protect, updateProviderStatus);
router.post('/documents', protect, upload.single('document'), uploadDocument);
router.post('/emergency-alert', protect, sendEmergencyAlert || ((req, res) => res.status(501).send("Not Implemented")));

module.exports = router;
