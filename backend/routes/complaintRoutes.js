const express = require('express');
const router = express.Router();
const { createComplaint, getUserComplaints, getAllComplaints,
    getComplaintStats, updateComplaintStatus } = require('../controllers/complaintController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', protect, createComplaint);
router.get('/', protect, getUserComplaints);

// Admin routes
router.get('/admin', protect, admin, getAllComplaints);
router.get('/admin/stats', protect, admin, getComplaintStats);
router.put('/admin/:id', protect, admin, updateComplaintStatus);

module.exports = router;
