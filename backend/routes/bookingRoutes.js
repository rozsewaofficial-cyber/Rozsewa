const express = require('express');
const router = express.Router();
const { 
    createBooking, getUserBookings, getProviderBookings, updateBooking, 
    updateBookingStatusByProvider, verifyStartOTP, verifyEndOTP, 
    getProviderReviews, submitReview,
    proposeSchedule, acceptSchedule, rejectSchedule, checkOverlapStatus,
    counterOfferBooking, acceptCounterOffer, rejectCounterOffer
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);
router.get('/provider', protect, getProviderBookings);
router.get('/provider/overlap-check', protect, checkOverlapStatus);
router.put('/:id', protect, updateBooking);
router.patch('/:id/status', protect, updateBookingStatusByProvider);
router.post('/:id/start', protect, verifyStartOTP);
router.post('/:id/complete', protect, verifyEndOTP);
router.post('/:id/review', protect, submitReview);
router.get('/provider/reviews', protect, getProviderReviews);

router.patch('/:id/propose-schedule', protect, proposeSchedule);
router.patch('/:id/accept-schedule', protect, acceptSchedule);
router.patch('/:id/reject-schedule', protect, rejectSchedule);

router.patch('/:id/counter-offer', protect, counterOfferBooking);
router.patch('/:id/accept-counter', protect, acceptCounterOffer);
router.patch('/:id/reject-counter', protect, rejectCounterOffer);

module.exports = router;
