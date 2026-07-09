const express = require('express');
const router = express.Router();
const { createTicket, getProviderTickets, createPublicTicket } = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');

router.post('/tickets', protect, createTicket);
router.get('/tickets', protect, getProviderTickets);
router.post('/public-tickets', createPublicTicket);

module.exports = router;
