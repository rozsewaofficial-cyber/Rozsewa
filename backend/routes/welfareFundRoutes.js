const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { contributeToWelfareFund, getMyWelfareFundContributions } = require('../controllers/welfareFundController');

router.post('/contribute', protect, contributeToWelfareFund);
router.get('/my-contributions', protect, getMyWelfareFundContributions);

module.exports = router;
