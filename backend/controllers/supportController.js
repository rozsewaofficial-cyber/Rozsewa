const { pageParams, paginate } = require('../utils/pagination');
const SupportTicket = require('../models/SupportTicket');
const Provider = require('../models/Provider');
// Used by the admin push below; it was never imported, so every one failed.
const { adminRecipients } = require('../utils/adminRecipients');
const { emitToProvider, emitToUser, getIO } = require('../config/socket');

// Who raised a ticket, as admin needs to see it. The partner fields were
// populated as `name`, which a Provider doesn't have, so every partner
// ticket read "Anonymous" with no number.
const OWNER_PROVIDER_FIELDS = 'ownerName shopName mobile vendorCode providerCategory';
const OWNER_USER_FIELDS = 'name mobile email role';

const isAdmin = (user) => ['admin', 'superadmin'].includes(user?.role);
const isOwner = (ticket, user) => {
    const id = String(user?._id);
    return String(ticket.providerId?._id || ticket.providerId || '') === id
        || String(ticket.userId?._id || ticket.userId || '') === id;
};
const senderRole = (user) => (isAdmin(user) ? 'admin' : user.role === 'provider' ? 'provider' : 'user');
const displayName = (user) => user.ownerName || user.shopName || user.name || 'User';

/** A ticket the caller may see: their own, or any for admin. */
const loadTicket = async (req, res) => {
    const ticket = await SupportTicket.findById(req.params.id)
        .populate('providerId', OWNER_PROVIDER_FIELDS)
        .populate('userId', OWNER_USER_FIELDS);
    if (!ticket) { res.status(404).json({ message: 'Ticket not found' }); return null; }
    // A partner only ever sees their own ticket (404, not 403, so ids can't be probed).
    if (!isAdmin(req.user) && !isOwner(ticket, req.user)) { res.status(404).json({ message: 'Ticket not found' }); return null; }
    return ticket;
};

/**
 * Tell both sides a ticket changed, so an open chat refreshes without a
 * reload. Only the id is sent; the content is fetched over the
 * authenticated API, since socket rooms are joined by id alone.
 */
const announce = (ticket) => {
    const payload = { ticketId: String(ticket._id) };
    try {
        if (ticket.providerId) emitToProvider(ticket.providerId._id || ticket.providerId, 'SUPPORT_TICKET_UPDATED', payload);
        if (ticket.userId) emitToUser(ticket.userId._id || ticket.userId, 'SUPPORT_TICKET_UPDATED', payload);
        const io = getIO();
        if (io) io.to('admin_room').emit('SUPPORT_TICKET_UPDATED', payload);
    } catch (err) { /* sockets not running (scripts) */ }
};

const notifyAdmins = async (title, body, ticket) => {
    try {
        const { sendNotificationToUser } = require('../config/notificationService');
        for (const admin of await adminRecipients()) {
            await sendNotificationToUser(admin._id, 'admin', {
                title, body,
                data: { type: 'support', id: ticket._id.toString(), link: '/admin/support' }
            });
        }
    } catch (err) {
        console.log('Admin push notification failed (skipping):', err.message);
    }
};

const notifyOwner = async (ticket, title, message) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: ticket.providerId?._id || ticket.providerId || ticket.userId?._id || ticket.userId,
            userRole: ticket.providerId ? 'provider' : 'user',
            title, message, type: 'system',
            data: { link: ticket.providerId ? '/provider/support' : '/support-tickets' }
        });
    } catch (err) {
        console.log('Push notification failed (skipping):', err.message);
    }
};

const CALL_TIMES = ['As soon as possible', 'Morning (9am - 12pm)', 'Afternoon (12pm - 4pm)', 'Evening (4pm - 8pm)'];

// @desc    Raise a support ticket
// @route   POST /api/support/tickets
// @access  Private
const createTicket = async (req, res) => {
    try {
        const { subject, description, category, priority, requestCall, preferredTime, callNote } = req.body;

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

        // "Request a Call" raises a ticket carrying the call request.
        if (requestCall) {
            const now = new Date();
            ticketData.callRequest = {
                status: 'requested',
                phone: req.user.mobile,
                preferredTime: CALL_TIMES.includes(preferredTime) ? preferredTime : CALL_TIMES[0],
                note: callNote ? String(callNote).slice(0, 500) : undefined,
                requestedAt: now,
                updatedAt: now
            };
        }

        const ticket = await SupportTicket.create(ticketData);
        announce(ticket);
        if (requestCall) {
            notifyAdmins('Call Requested', `${displayName(req.user)} asked for a call back: "${subject}".`, ticket);
        }

        // Push Notification for Admins (High Priority Ticket)
        if (priority === 'high') {
            try {
                const User = require('../models/User');
                const { sendNotificationToUser } = require('../config/notificationService');
                
                const admins = await adminRecipients();
                
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
            
        const tickets = await paginate(
            SupportTicket.find(query).sort({ updatedAt: -1, createdAt: -1 }),
            pageParams(req)
        );

        // The screen shows how many are still open, which one page cannot say.
        res.set('X-Total-Count', String(await SupportTicket.countDocuments(query)));
        res.set('X-Active-Count', String(await SupportTicket.countDocuments({
            ...query,
            status: { $in: ['pending', 'open'] }
        })));
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all tickets (Admin)
// @route   GET /api/support/admin/tickets
// @access  Private (Admin)
const getAllTickets = async (req, res) => {
    try {
        // Every ticket ever raised, filtered by the status tab if one is set.
        const scope = req.query.status ? { status: req.query.status } : {};
        const tickets = await paginate(
            SupportTicket.find(scope)
                .populate('userId', OWNER_USER_FIELDS)
                .populate('providerId', OWNER_PROVIDER_FIELDS)
                // Latest activity first: a new message or call request on an
                // older ticket comes to the top instead of staying buried.
                .sort({ updatedAt: -1, createdAt: -1 }),
            pageParams(req)
        );

        res.set('X-Total-Count', String(await SupportTicket.countDocuments(scope)));
        res.set('X-Active-Count', String(await SupportTicket.countDocuments({
            status: { $in: ['pending', 'open'] }
        })));
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
        if (reply && String(reply).trim()) {
            ticket.messages.push({ sender: 'admin', senderId: req.user._id, senderName: 'RozSewa Support', text: String(reply).trim().slice(0, 2000) });
        }
        ticket.updatedAt = new Date();
        await ticket.save();
        announce(ticket);

        // Push Notification for User/Provider
        try {
            const { notifyUser } = require('../config/notificationService');
            const recipientId = ticket.providerId || ticket.userId;
            const recipientRole = ticket.providerId ? 'provider' : 'user';
            
            await notifyUser({
                userId: recipientId,
                userRole: recipientRole,
                title: 'Admin Replied to Support Ticket',
                message: `Admin replied to your ticket: "${ticket.subject}".`,
                type: 'system',
                data: {
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

const createPublicTicket = async (req, res) => {
    try {
        const { subject, description, category, priority, name, mobile, email, role } = req.body;
        
        const ticketData = {
            subject,
            description,
            category: category || 'other',
            priority: priority || 'low',
            contactInfo: {
                name,
                mobile,
                email,
                role
            }
        };

        // Raised while logged out: attach it to the partner registered with
        // that mobile, so admin sees who it is. Their own ticket list shows
        // it too once they log in.
        const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
        if (cleanMobile.length === 10 && role !== 'customer') {
            const partner = await Provider.findOne({ mobile: cleanMobile }).select('_id').lean();
            if (partner) ticketData.providerId = partner._id;
        }

        const ticket = await SupportTicket.create(ticketData);

        // Push Notification for Admins (High Priority Ticket or General Support)
        try {
            const User = require('../models/User');
            const { sendNotificationToUser } = require('../config/notificationService');
            
            const admins = await adminRecipients();
            
            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title: `New Public Ticket (${role || 'Partner'})`,
                    body: `New support request from ${name || 'Anonymous'}: "${subject}".`,
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

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    One ticket with its conversation
// @route   GET /api/support/tickets/:id
// @access  Private (owner or admin)
const getTicket = async (req, res) => {
    try {
        const ticket = await loadTicket(req, res);
        if (ticket) res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send a chat message on a ticket
// @route   POST /api/support/tickets/:id/messages
// @access  Private (owner or admin)
const addMessage = async (req, res) => {
    try {
        const text = String(req.body.text || '').trim();
        if (!text) return res.status(400).json({ message: 'Type a message' });
        if (text.length > 2000) return res.status(400).json({ message: 'Message is too long (2000 characters max)' });

        const ticket = await loadTicket(req, res);
        if (!ticket) return;

        const fromAdmin = isAdmin(req.user);
        ticket.messages.push({
            sender: senderRole(req.user),
            senderId: req.user._id,
            senderName: fromAdmin ? 'RozSewa Support' : displayName(req.user),
            text
        });
        // A reply moves the ticket along; a partner writing on a resolved or
        // closed ticket reopens it.
        if (fromAdmin && ticket.status === 'pending') ticket.status = 'open';
        if (!fromAdmin && ['resolved', 'closed'].includes(ticket.status)) ticket.status = 'open';
        ticket.updatedAt = new Date();
        await ticket.save();
        announce(ticket);

        if (fromAdmin) notifyOwner(ticket, 'New reply from RozSewa Support', text.slice(0, 120));
        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Ask for a call back on a ticket
// @route   POST /api/support/tickets/:id/call-request
// @access  Private (owner)
const requestCall = async (req, res) => {
    try {
        const ticket = await loadTicket(req, res);
        if (!ticket) return;
        if (isAdmin(req.user)) return res.status(403).json({ message: 'Only the ticket owner can request a call' });

        // One call request at a time: asking again returns the open one.
        if (['requested', 'in_progress'].includes(ticket.callRequest?.status)) return res.json(ticket);

        const now = new Date();
        ticket.callRequest = {
            status: 'requested',
            phone: req.user.mobile,
            preferredTime: CALL_TIMES.includes(req.body.preferredTime) ? req.body.preferredTime : CALL_TIMES[0],
            note: req.body.note ? String(req.body.note).slice(0, 500) : undefined,
            requestedAt: now,
            updatedAt: now
        };
        if (['resolved', 'closed'].includes(ticket.status)) ticket.status = 'open';
        ticket.updatedAt = now;
        await ticket.save();
        announce(ticket);
        notifyAdmins('Call Requested', `${displayName(req.user)} asked for a call back on "${ticket.subject}".`, ticket);
        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Move a call request along (admin), or cancel it (owner)
// @route   PATCH /api/support/tickets/:id/call-request
// @access  Private (owner: cancel only; admin: in_progress / completed / cancelled)
const updateCallRequest = async (req, res) => {
    try {
        const { status } = req.body;
        const ticket = await loadTicket(req, res);
        if (!ticket) return;
        if (!ticket.callRequest?.status) return res.status(400).json({ message: 'No call was requested on this ticket' });

        const admin = isAdmin(req.user);
        const allowed = admin ? ['in_progress', 'completed', 'cancelled'] : ['cancelled'];
        if (!allowed.includes(status)) return res.status(400).json({ message: 'That status change is not allowed' });
        if (['completed', 'cancelled'].includes(ticket.callRequest.status)) {
            return res.status(400).json({ message: `This call request is already ${ticket.callRequest.status}` });
        }

        ticket.callRequest.status = status;
        ticket.callRequest.updatedAt = new Date();
        if (admin) ticket.callRequest.handledBy = req.user.name || 'Admin';
        ticket.markModified('callRequest');
        ticket.updatedAt = new Date();
        await ticket.save();
        announce(ticket);
        if (admin && status === 'in_progress') notifyOwner(ticket, 'Support is calling you', `We're calling you about "${ticket.subject}".`);
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Set a ticket's status (admin)
// @route   PATCH /api/support/tickets/:id/status
// @access  Private (Admin)
const updateTicketStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'open', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({ message: 'Unknown status' });
        }
        const ticket = await loadTicket(req, res);
        if (!ticket) return;
        ticket.status = status;
        ticket.updatedAt = new Date();
        await ticket.save();
        announce(ticket);
        if (status === 'resolved') notifyOwner(ticket, 'Support ticket resolved', `Your ticket "${ticket.subject}" was marked resolved.`);
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createTicket,
    getProviderTickets,
    getAllTickets,
    replyTicket,
    createPublicTicket,
    getTicket,
    addMessage,
    requestCall,
    updateCallRequest,
    updateTicketStatus,
    CALL_TIMES
};
