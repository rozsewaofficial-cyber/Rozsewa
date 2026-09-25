const express = require('express');
const router = express.Router();
const { createBenefitRequest, getMyBenefitRequests } = require('../controllers/benefitRequestController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBenefitRequest);
router.get('/', protect, getMyBenefitRequests);

module.exports = router;
