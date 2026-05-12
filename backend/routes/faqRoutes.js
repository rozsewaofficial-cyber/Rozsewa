const express = require('express');
const router = express.Router();
const { getFAQs, createFAQ, updateFAQ, deleteFAQ } = require('../controllers/faqController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', getFAQs); // Public
router.post('/', protect, admin, createFAQ); // Admin
router.put('/:id', protect, admin, updateFAQ); // Admin
router.delete('/:id', protect, admin, deleteFAQ); // Admin

module.exports = router;
