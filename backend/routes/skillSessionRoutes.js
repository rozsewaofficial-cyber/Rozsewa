const express = require('express');
const router = express.Router();
const {
    getEligibility,
    bookSession,
    getMySessions,
    getSessionById,
    cancelSession
} = require('../controllers/skillSessionController');
const { protect } = require('../middleware/authMiddleware');

router.get('/eligibility', protect, getEligibility);
router.post('/book', protect, bookSession);
router.get('/mine', protect, getMySessions);
router.put('/:id/cancel', protect, cancelSession);
router.get('/:id', protect, getSessionById);

module.exports = router;
