const express = require('express');
const adminV2Router = express.Router();
const providerV2Router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const {
    adjustFreeTrial,
    configureWaiver,
    getCommissionAnalytics,
    getCommissionPreview,
    purchaseSubscription,
    renewSubscription,
    getProviderSubscriptionHistory,
    manualActivateSubscription,
    manualCancelSubscription,
    applyOverride
} = require('../controllers/v2CommissionController');

// --- Admin V2 Routes ---
adminV2Router.post('/providers/:id/free-trial/adjust', protect, admin, adjustFreeTrial);
adminV2Router.post('/providers/:id/waiver', protect, admin, configureWaiver);
adminV2Router.get('/commission/analytics', protect, admin, getCommissionAnalytics);
adminV2Router.post('/providers/:id/subscription/manual', protect, admin, manualActivateSubscription);
adminV2Router.post('/providers/:id/subscription/cancel', protect, admin, manualCancelSubscription);
adminV2Router.post('/providers/:id/override', protect, admin, applyOverride);

// --- Provider V2 Routes ---
providerV2Router.get('/commission-preview', protect, getCommissionPreview);
providerV2Router.post('/subscription/purchase', protect, purchaseSubscription);
providerV2Router.post('/subscription/renew', protect, renewSubscription);
providerV2Router.get('/subscription/history', protect, getProviderSubscriptionHistory);

module.exports = {
    adminV2Router,
    providerV2Router
};
