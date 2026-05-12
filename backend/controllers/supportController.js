const SupportTicket = require('../models/SupportTicket');

// @desc    Raise a support ticket
// @route   POST /api/support/tickets
// @access  Private
const createTicket = async (req, res) => {
    try {
        const { subject, description, category, priority } = req.body;
        
        const ticketData = {
            subject,
            description,
            category,
            priority
        };

        if (req.user.role === 'provider') {
            ticketData.providerId = req.user._id;
        } else {
            ticketData.userId = req.user._id;
        }

        const ticket = await SupportTicket.create(ticketData);

        // Push Notification for Admins (High Priority Ticket)
        if (priority === 'high') {
            try {
                const User = require('../models/User');
                const { sendNotificationToUser } = require('../config/notificationService');
                
                const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
                
                for (const admin of admins) {
                    await sendNotificationToUser(admin._id, 'admin', {
                        title: 'High Priority Ticket Received',
                        body: `New support ticket received: "${subject}".`,
                        data: {
                            type: 'support',
                            id: ticket._id.toString(),
                            link: '/admin/support'
                        }
                    });
                }
            } catch (err) {
                console.log('Admin push notification failed (skipping):', err.message);
            }
        }

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get provider tickets
// @route   GET /api/support/tickets
// @access  Private
const getProviderTickets = async (req, res) => {
    try {
        const query = req.user.role === 'provider' 
            ? { providerId: req.user._id } 
            : { userId: req.user._id };
            
        const tickets = await SupportTicket.find(query).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reply to a support ticket
// @route   PATCH /api/support/tickets/:id/reply
// @access  Private (Admin)
const replyTicket = async (req, res) => {
    try {
        const { reply } = req.body;
        const ticket = await SupportTicket.findById(req.params.id);
        
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        
        ticket.reply = reply;
        ticket.status = 'resolved';
        await ticket.save();
        
        // Push Notification for User/Provider
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            const recipientId = ticket.providerId || ticket.userId;
            const recipientRole = ticket.providerId ? 'provider' : 'customer';
            
            await sendNotificationToUser(recipientId, recipientRole, {
                title: 'Admin Replied to Support Ticket',
                body: `Admin replied to your ticket: "${ticket.subject}".`,
                data: {
                    type: 'support',
                    id: ticket._id.toString(),
                    link: ticket.providerId ? '/provider/support' : '/support-tickets'
                }
            });
        } catch (err) {
            console.log('Push notification failed (skipping):', err.message);
        }
        
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTicket,
    getProviderTickets,
    replyTicket
};
