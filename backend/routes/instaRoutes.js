const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const customer = require('../controllers/instaCustomerController');
const provider = require('../controllers/instaProviderController');

/* ------------------------------- customer ------------------------------- */
// Service discovery is public so the Insta menu can render before login.
router.get('/services', customer.getServices);

router.post('/quote', protect, customer.getQuote);
router.post('/partners', protect, customer.getAvailablePartners);
router.post('/jobs', protect, customer.createJob);
router.get('/jobs', protect, customer.getMyJobs);

/* ------------------------------- provider ------------------------------- */
// Declared before the customer `/jobs/:id` routes so "provider" is never
// captured as a job id.
router.get('/provider/profile', protect, provider.getInstaProfile);
router.patch('/provider/toggle', protect, provider.toggleInstaWork);
router.put('/provider/services', protect, provider.setInstaServices);
router.put('/provider/hours', protect, provider.setWorkingHours);
router.post('/provider/ping', protect, provider.pingLocation);
router.get('/provider/jobs', protect, provider.getProviderJobs);

router.patch('/provider/jobs/:id/accept', protect, provider.acceptJob);
router.patch('/provider/jobs/:id/reject', protect, provider.rejectJob);
router.patch('/provider/jobs/:id/on-the-way', protect, provider.markOnTheWay);
router.patch('/provider/jobs/:id/arrived', protect, provider.markArrived);
router.patch('/provider/jobs/:id/start', protect, provider.startWork);
router.post('/provider/jobs/:id/extension', protect, provider.requestExtension);
router.patch('/provider/jobs/:id/stop', protect, provider.stopWork);
router.patch('/provider/jobs/:id/cancel', protect, provider.providerCancelJob);

/* --------------------------- customer job actions --------------------------- */
router.get('/jobs/:id', protect, customer.getJob);
router.patch('/jobs/:id/extension', protect, customer.respondToExtension);
router.patch('/jobs/:id/select-partner', protect, customer.selectPartner);
router.patch('/jobs/:id/confirm', protect, customer.confirmWork);
router.post('/jobs/:id/payment-order', protect, customer.createPaymentOrder);
router.patch('/jobs/:id/pay', protect, customer.payJob);
router.patch('/jobs/:id/cancel', protect, customer.cancelJob);

module.exports = router;
