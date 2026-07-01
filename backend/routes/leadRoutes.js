const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    createLead,
    getNearbyLeads,
    unlockLead,
    raiseDispute,
    getLeadPlans,
    getLeadDetails,
    getAdminLeads,
    getAdminDisputes,
    resolveDispute,
    forceCloseLead,
    getAdminStats
} = require('../controllers/leadController');

// Lead routes
router.post('/', protect, createLead);
router.get('/nearby', protect, getNearbyLeads);
router.get('/plans', protect, getLeadPlans);
router.post('/:id/unlock', protect, unlockLead);
router.post('/:id/dispute', protect, raiseDispute);

// Admin-specific lead management routes
router.get('/admin', protect, admin, getAdminLeads);
router.get('/admin/disputes', protect, admin, getAdminDisputes);
router.post('/admin/disputes/:id/resolve', protect, admin, resolveDispute);
router.post('/admin/:id/close', protect, admin, forceCloseLead);
router.get('/admin/stats', protect, admin, getAdminStats);

// Detail lookup (must be registered last)
router.get('/:id', protect, getLeadDetails);

module.exports = router;
