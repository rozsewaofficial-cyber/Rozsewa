const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/providerBannerController');
const {
    registerProvider,
    registerSewak,
    authProvider,
    getProviderProfile,
    getProviderDocuments,
    selectServices,
    updateProviderStatus,
    updateProviderProfile,
    getProviderStats,
    checkProviderExistence,
    uploadDocument,
    sendEmergencyAlert,
    verifyProviderCredentials,
    getSubscriptionPlans,
    getProviderMenu,
    reapplyKYC,
    uploadLiveVideo,
    submitKYC
} = require('../controllers/providerController');
const { getProviderOffers, createProviderOffer } = require('../controllers/offerController');
const { getStaff, createStaff, deleteStaff, toggleStaffStatus } = require('../controllers/staffController');
const { requestWithdrawal, getProviderWithdrawals } = require('../controllers/withdrawalController');
const { getPublicCategories } = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { upload, uploadVideo } = require('../config/cloudinary');

// Public routes
router.post('/register', registerProvider);
router.post('/register-sewak', registerSewak);
router.post('/login', authProvider);
router.post('/verify-credentials', verifyProviderCredentials);
router.post('/check-existence', checkProviderExistence);
router.get('/categories', getPublicCategories);
router.get('/service-radius-limits', async (req, res) => {
    try {
        const Setting = require('../models/Setting');
        const setting = await Setting.findOne({ key: 'provider_service_radius_limits' });
        if (!setting) return res.json({ minimumRadius: 1, maximumRadius: 50 });
        return res.json(setting.value);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Plans with the server's price for every offered duration.
router.get('/banner-plans', bannerController.getPlans);

// Protected routes
router.get('/profile', protect, getProviderProfile);
router.put('/profile', protect, updateProviderProfile);
router.put('/select-services', protect, selectServices);
router.get('/stats', protect, getProviderStats);
router.patch('/status', protect, updateProviderStatus);
router.get('/subscription-plans', protect, getSubscriptionPlans);
router.get('/menu', protect, getProviderMenu);
router.get('/documents', protect, getProviderDocuments);
router.post('/documents', protect, upload.single('document'), uploadDocument);
router.post('/live-video', protect, uploadVideo.single('video'), uploadLiveVideo);
router.post('/submit-kyc', protect, submitKYC);
router.post('/emergency-alert', protect, sendEmergencyAlert || ((req, res) => res.status(501).send("Not Implemented")));
router.patch('/reapply-kyc', protect, reapplyKYC);

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

// Banner routes
router.post('/banners/order', protect, bannerController.createBannerOrder);
router.post('/banners', protect, bannerController.createBannerRequest);
router.post('/banners/wallet', protect, bannerController.createBannerWithWallet);
router.get('/banners', protect, bannerController.getMyBanners);

module.exports = router;
