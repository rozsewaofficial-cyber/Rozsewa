const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    contributeToWelfareFund,
    getMyWelfareFundContributions,
    getWelfareFundSummary
} = require('../controllers/welfareFundController');

// Customers and partners share these: `protect` resolves either, and the
// controller works out which wallet the money comes from.
router.post('/contribute', protect, contributeToWelfareFund);
router.get('/my-contributions', protect, getMyWelfareFundContributions);
router.get('/summary', protect, getWelfareFundSummary);

module.exports = router;
