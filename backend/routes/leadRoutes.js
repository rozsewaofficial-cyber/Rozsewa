const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    // Form Schema
    getFormSchema,
    // Draft
    saveDraft,
    updateDraft,
    deleteDraft,
    // Lead Lifecycle
    createLead,
    updateLead,
    getLeadDetails,
    getLeadActivity,
    getCustomerLeads,
    // Provider
    getNearbyLeads,
    unlockLead,
    raiseDispute,
    getLeadPlans,
    // Admin — Leads
    getAdminLeads,
    getAdminDisputes,
    resolveDispute,
    forceCloseLead,
    getAdminStats,
    // Admin — Form Builder
    getLeadForms,
    createLeadForm,
    updateLeadForm,
    publishLeadForm,
    deleteLeadForm
} = require('../controllers/leadController');

// ─── Form Schema ──────────────────────────────────────────────────────────────
// GET /api/leads/forms/:categoryId?serviceId=xxx
router.get('/forms/:categoryId', getFormSchema);

// ─── Draft System ─────────────────────────────────────────────────────────────
router.post('/draft',         protect, saveDraft);
router.put('/draft/:id',      protect, updateDraft);
router.delete('/draft/:id',   protect, deleteDraft);

// ─── Customer ─────────────────────────────────────────────────────────────────
router.get('/my',             protect, getCustomerLeads);
router.post('/',              protect, createLead);
router.put('/:id',            protect, updateLead);

// ─── Provider ─────────────────────────────────────────────────────────────────
router.get('/nearby',         protect, getNearbyLeads);
router.get('/plans',          protect, getLeadPlans);
router.post('/:id/unlock',    protect, unlockLead);
router.post('/:id/dispute',   protect, raiseDispute);

// ─── Admin — Lead Management ─────────────────────────────────────────────────
router.get('/admin',                           protect, admin, getAdminLeads);
router.get('/admin/stats',                     protect, admin, getAdminStats);
router.get('/admin/disputes',                  protect, admin, getAdminDisputes);
router.post('/admin/disputes/:id/resolve',     protect, admin, resolveDispute);
router.post('/admin/:id/close',                protect, admin, forceCloseLead);

// ─── Admin — Lead Form Builder ────────────────────────────────────────────────
router.get('/admin/forms',                     protect, admin, getLeadForms);
router.post('/admin/forms',                    protect, admin, createLeadForm);
router.put('/admin/forms/:id',                 protect, admin, updateLeadForm);
router.post('/admin/forms/:id/publish',        protect, admin, publishLeadForm);
router.delete('/admin/forms/:id',              protect, admin, deleteLeadForm);

// ─── Detail + Activity (must be last to avoid param conflicts) ─────────────────
router.get('/activity/:id',   protect, getLeadActivity);
router.get('/:id',            protect, getLeadDetails);

module.exports = router;
