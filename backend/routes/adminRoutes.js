const express = require('express');
const router = express.Router();
const {
    getProviders,
    deleteProvider,
    updateProviderStatus,
    updateProviderPlan,
    getAdminStats,
    getBookings,
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getUsers,
    toggleUserStatus,
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
    deleteEmergencyAlert,
    getAllAdmins,
    createAdmin,
    updateAdminPermissions,
    verifySuperAdminPin,
    updateSuperAdminPin,
    deleteAdmin,
    updateAdmin,
    getAllSewaks,
    createSewak,
    getPendingSewaks,
    verifySewak,
    rejectSewak,
    updateProviderCategory,
    getAdminSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    getAuditLogs,
    getNightChargeSettings,
    updateGlobalNightCharge,
    updateCategoryNightCharge,
    applyGlobalNightChargeToAll,
    getAdminKycPerformance,
    getSewakIncentives,
    updateSewakIncentiveSettings
} = require('../controllers/adminController');

const { protect, admin, superadmin, supervisor, employee } = require('../middleware/authMiddleware');

// HRM Management

router.get('/employees', protect, supervisor, getEmployees);
router.post('/employees', protect, supervisor, addEmployee);
router.put('/employees/:id', protect, supervisor, updateEmployee);
router.delete('/employees/:id', protect, supervisor, deleteEmployee);

// Provider management
router.get('/providers', protect, admin, getProviders);
router.delete('/providers/:id', protect, admin, deleteProvider);
router.put('/providers/:id/status', protect, admin, updateProviderStatus);
router.put('/providers/:id/plan', protect, admin, updateProviderPlan);
router.put('/providers/:id/category-role', protect, admin, updateProviderCategory);

// Night Charge Management
router.get('/night-charge', protect, admin, getNightChargeSettings);
router.post('/night-charge/global', protect, admin, updateGlobalNightCharge);
router.put('/night-charge/category/:id', protect, admin, updateCategoryNightCharge);
router.post('/night-charge/apply-all', protect, admin, applyGlobalNightChargeToAll);

// Category management
router.get('/categories', protect, admin, getCategories);
router.post('/categories', protect, admin, addCategory);
router.put('/categories/:id', protect, admin, updateCategory);
router.delete('/categories/:id', protect, admin, deleteCategory);

// User management
router.get('/users', protect, admin, getUsers);
router.put('/users/:id/toggle-status', protect, admin, toggleUserStatus);

// Banner management
router.get('/banners', protect, admin, getBanners);
router.post('/banners', protect, admin, addBanner);
router.put('/banners/:id', protect, admin, updateBanner);
router.delete('/banners/:id', protect, admin, deleteBanner);
router.patch('/banners/:id/status', protect, admin, toggleBannerStatus);

// Dashboard stats
router.get('/stats', protect, employee, getAdminStats);

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
router.post('/profile', protect, employee, updateAdminProfile);

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

// Super Admin & Admin Management
router.get('/admins', protect, superadmin, getAllAdmins);
router.post('/admins', protect, superadmin, createAdmin);
router.put('/admins/:id', protect, superadmin, updateAdmin);
router.put('/admins/:id/permissions', protect, superadmin, updateAdminPermissions);
router.post('/verify-pin', protect, admin, verifySuperAdminPin);
router.post('/update-pin', protect, superadmin, updateSuperAdminPin);
    router.delete('/admins/:id', protect, superadmin, deleteAdmin);
    router.get('/audit-logs', protect, superadmin, getAuditLogs);
        router.get('/kyc-performance', protect, superadmin, getAdminKycPerformance);
    router.get('/sewak-incentives', protect, superadmin, getSewakIncentives);
    router.post('/sewak-incentive-settings', protect, superadmin, updateSewakIncentiveSettings);

// Subscription Plans Management
router.get('/subscriptions', protect, admin, getAdminSubscriptionPlans);
router.post('/subscriptions', protect, admin, createSubscriptionPlan);
router.put('/subscriptions/:id', protect, admin, updateSubscriptionPlan);
router.delete('/subscriptions/:id', protect, admin, deleteSubscriptionPlan);

// Sewak Management
router.get('/sewaks', protect, admin, getAllSewaks);
router.post('/sewaks', protect, admin, createSewak);
router.get('/sewaks/pending-kyc', protect, admin, getPendingSewaks);
router.put('/sewaks/:id/verify', protect, admin, verifySewak);
router.put('/sewaks/:id/reject', protect, admin, rejectSewak);

module.exports = router;
