const express = require('express');
const router = express.Router();
const { getPendingVendors, verifyVendor } = require('../controllers/wfhController');
const { protect, wfh } = require('../middleware/authMiddleware');

router.get('/pending-vendors', protect, wfh, getPendingVendors);
router.put('/verify-vendor/:id', protect, wfh, verifyVendor);

module.exports = router;
