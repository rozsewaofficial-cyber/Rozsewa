const express = require('express');
const router = express.Router();
const { createTicket, getProviderTickets, getAllTickets, replyTicket, createPublicTicket } = require('../controllers/supportController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/tickets', protect, createTicket);
router.get('/tickets', protect, getProviderTickets);
router.get('/admin/tickets', protect, admin, getAllTickets);
router.patch('/tickets/:id/reply', protect, admin, replyTicket);
router.post('/public-tickets', createPublicTicket);

module.exports = router;
