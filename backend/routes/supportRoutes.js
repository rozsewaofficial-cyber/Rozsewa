const express = require('express');
const router = express.Router();
const { createTicket, getProviderTickets, getAllTickets, replyTicket, createPublicTicket, getTicket, addMessage, requestCall, updateCallRequest, updateTicketStatus } = require('../controllers/supportController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/tickets', protect, createTicket);
router.get('/tickets', protect, getProviderTickets);
router.get('/admin/tickets', protect, admin, getAllTickets);
router.patch('/tickets/:id/reply', protect, admin, replyTicket);
router.post('/public-tickets', createPublicTicket);
// One ticket: its conversation (Live Chat) and call request. Owner or admin.
router.get('/tickets/:id', protect, getTicket);
router.post('/tickets/:id/messages', protect, addMessage);
router.post('/tickets/:id/call-request', protect, requestCall);
router.patch('/tickets/:id/call-request', protect, updateCallRequest);
router.patch('/tickets/:id/status', protect, admin, updateTicketStatus);

module.exports = router;
