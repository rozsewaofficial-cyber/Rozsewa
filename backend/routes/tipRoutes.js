const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createTipOrder, verifyTip, getTipsForBooking, recordCashTip } = require('../controllers/tipController');

router.post('/order', protect, createTipOrder);
router.post('/verify', protect, verifyTip);
// A tip paid in cash along with the bill (recorded, not credited).
router.post('/cash', protect, recordCashTip);
router.get('/booking/:bookingId', protect, getTipsForBooking);

module.exports = router;
