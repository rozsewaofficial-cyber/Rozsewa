const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createTipOrder, verifyTip, getTipsForBooking } = require('../controllers/tipController');

router.post('/order', protect, createTipOrder);
router.post('/verify', protect, verifyTip);
router.get('/booking/:bookingId', protect, getTipsForBooking);

module.exports = router;
