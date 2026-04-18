const express = require('express');
const router = express.Router();
const {
    getProviders,
    updateProviderStatus,
    getAdminStats,
    getBookings,
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getUsers,
    getBanners,
    addBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    getEmergencyData,
    broadcastEmergency,
    get99CardData,
    getFeedbackData,
    getActivityLogs,
    getSettings,
    updateSettings,
    updateAdminProfile,
    getPromotions,
    createPromotion,
    deletePromotion,
    getZones,
    addZone,
    deleteZone,
    getEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    deleteEmergencyAlert
} = require('../controllers/adminController');

const { protect, admin } = require('../middleware/authMiddleware');

// HRM Management

router.get('/employees', protect, admin, getEmployees);
router.post('/employees', protect, admin, addEmployee);
router.put('/employees/:id', protect, admin, updateEmployee);
router.delete('/employees/:id', protect, admin, deleteEmployee);

// Provider management
router.get('/providers', protect, admin, getProviders);
router.put('/providers/:id/status', protect, admin, updateProviderStatus);

// Category management
router.get('/categories', protect, admin, getCategories);
router.post('/categories', protect, admin, addCategory);
router.put('/categories/:id', protect, admin, updateCategory);
router.delete('/categories/:id', protect, admin, deleteCategory);

// User management
router.get('/users', protect, admin, getUsers);

// Banner management
router.get('/banners', protect, admin, getBanners);
router.post('/banners', protect, admin, addBanner);
router.put('/banners/:id', protect, admin, updateBanner);
router.delete('/banners/:id', protect, admin, deleteBanner);
router.patch('/banners/:id/status', protect, admin, toggleBannerStatus);

// Dashboard stats
router.get('/stats', protect, admin, getAdminStats);

// Emergency control
router.get('/emergency', protect, admin, getEmergencyData);
router.post('/emergency/broadcast', protect, admin, broadcastEmergency);
router.delete('/emergency/:id', protect, admin, deleteEmergencyAlert);

// 99 Card management
router.get('/99cards', protect, admin, get99CardData);

// Feedback moderation
router.get('/feedback', protect, admin, getFeedbackData);

// Activity logs
router.get('/activity', protect, admin, getActivityLogs);

// Platform Settings & Profile
router.get('/settings', protect, admin, getSettings);
router.post('/settings', protect, admin, updateSettings);
router.post('/profile', protect, admin, updateAdminProfile);

// Booking management
router.get('/bookings', protect, admin, getBookings);

// Promotion management
router.get('/promotions', protect, admin, getPromotions);
router.post('/promotions', protect, admin, createPromotion);
router.delete('/promotions/:id', protect, admin, deletePromotion);

// Zone Management
router.get('/zones', protect, admin, getZones);
router.post('/zones', protect, admin, addZone);
router.delete('/zones/:id', protect, admin, deleteZone);

module.exports = router;

