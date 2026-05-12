const express = require('express');
const router = express.Router();
const { createBooking, getUserBookings, getProviderBookings, updateBooking, updateBookingStatusByProvider, verifyStartOTP, verifyEndOTP, getProviderReviews, submitReview } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);
router.get('/provider', protect, getProviderBookings);
router.put('/:id', protect, updateBooking);
router.patch('/:id/status', protect, updateBookingStatusByProvider);
router.post('/:id/start', protect, verifyStartOTP);
router.post('/:id/complete', protect, verifyEndOTP);
router.post('/:id/review', protect, submitReview);
router.get('/provider/reviews', protect, getProviderReviews);

module.exports = router;
