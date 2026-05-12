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
    sendEmergencyAlert,
    verifyProviderCredentials,
    getSubscriptionPlans,
    getProviderMenu
} = require('../controllers/providerController');
const { getProviderOffers, createProviderOffer } = require('../controllers/offerController');
const { getStaff, createStaff, deleteStaff, toggleStaffStatus } = require('../controllers/staffController');
const { requestWithdrawal, getProviderWithdrawals } = require('../controllers/withdrawalController');
const { getPublicCategories } = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Public routes
router.post('/register', registerProvider);
router.post('/login', authProvider);
router.post('/verify-credentials', verifyProviderCredentials);
router.post('/check-existence', checkProviderExistence);
router.get('/categories', getPublicCategories);

// Protected routes
router.get('/profile', protect, getProviderProfile);
router.put('/profile', protect, updateProviderProfile);
router.get('/stats', protect, getProviderStats);
router.patch('/status', protect, updateProviderStatus);
router.get('/subscription-plans', protect, getSubscriptionPlans);
router.get('/menu', protect, getProviderMenu);
router.post('/documents', protect, upload.single('document'), uploadDocument);
router.post('/emergency-alert', protect, sendEmergencyAlert || ((req, res) => res.status(501).send("Not Implemented")));

// Offer routes
router.get('/offers', protect, getProviderOffers);
router.post('/offers', protect, createProviderOffer);

// Staff routes
router.get('/staff', protect, getStaff);
router.post('/staff', protect, createStaff);
router.delete('/staff/:id', protect, deleteStaff);
router.patch('/staff/:id/status', protect, toggleStaffStatus);

// Withdrawal routes
router.post('/withdraw', protect, requestWithdrawal);
router.get('/withdrawals', protect, getProviderWithdrawals);

module.exports = router;
