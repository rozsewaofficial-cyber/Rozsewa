const User = require('../models/User');
const Provider = require('../models/Provider');
const Broadcast = require('../models/Broadcast');
const { notifyUser } = require('../config/notificationService');
const { sendWhatsAppMessage } = require('../services/whatsappService');

// @desc    Search customers/partners/sewaks by name or mobile, for "specific" targeting
// @route   GET /api/admin/broadcast/recipients?q=
const searchRecipients = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.json([]);

        const regex = new RegExp(q, 'i');

        const [customers, providers] = await Promise.all([
            User.find({ role: 'customer', $or: [{ name: regex }, { mobile: regex }] })
                .select('name mobile').limit(10).lean(),
            Provider.find({ $or: [{ ownerName: regex }, { shopName: regex }, { mobile: regex }] })
                .select('ownerName shopName mobile providerCategory').limit(10).lean()
        ]);

        const results = [
            ...customers.map(c => ({ id: c._id, name: c.name, mobile: c.mobile, role: 'customer' })),
            ...providers.map(p => ({
                id: p._id,
                name: p.ownerName || p.shopName,
                mobile: p.mobile,
                role: p.providerCategory === 'sewak' ? 'sewak' : 'partner'
            }))
        ];

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get recipient counts per audience segment (for UI preview)
// @route   GET /api/admin/broadcast/audience-counts
const getAudienceCounts = async (req, res) => {
    try {
        const [totalCustomers, totalPartners, totalSewaks] = await Promise.all([
            User.countDocuments({ role: 'customer' }),
            Provider.countDocuments({ providerCategory: { $ne: 'sewak' } }),
            Provider.countDocuments({ providerCategory: 'sewak' })
        ]);
        res.json({
            all_customers: totalCustomers,
            all_partners: totalPartners,
            all_sewaks: totalSewaks,
            all: totalCustomers + totalPartners + totalSewaks
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Resolves a targetType (+ optional explicit recipients for 'specific') into a
// flat list of { id, role: 'customer'|'partner'|'sewak', name, mobile }.
const resolveAudience = async (targetType, recipients) => {
    if (targetType === 'specific') {
        if (!Array.isArray(recipients) || recipients.length === 0) return [];
        const customerIds = recipients.filter(r => r.role === 'customer').map(r => r.id);
        const providerIds = recipients.filter(r => r.role === 'partner' || r.role === 'sewak').map(r => r.id);

        const [customers, providers] = await Promise.all([
            customerIds.length ? User.find({ _id: { $in: customerIds } }).select('name mobile').lean() : [],
            providerIds.length ? Provider.find({ _id: { $in: providerIds } }).select('ownerName mobile providerCategory').lean() : []
        ]);

        return [
            ...customers.map(c => ({ id: c._id, role: 'customer', name: c.name, mobile: c.mobile })),
            ...providers.map(p => ({ id: p._id, role: p.providerCategory === 'sewak' ? 'sewak' : 'partner', name: p.ownerName, mobile: p.mobile }))
        ];
    }

    const wantCustomers = targetType === 'all' || targetType === 'all_customers';
    const wantPartners = targetType === 'all' || targetType === 'all_partners';
    const wantSewaks = targetType === 'all' || targetType === 'all_sewaks';

    const [customers, partners, sewaks] = await Promise.all([
        wantCustomers ? User.find({ role: 'customer' }).select('name mobile').lean() : [],
        wantPartners ? Provider.find({ providerCategory: { $ne: 'sewak' } }).select('ownerName mobile').lean() : [],
        wantSewaks ? Provider.find({ providerCategory: 'sewak' }).select('ownerName mobile').lean() : []
    ]);

    return [
        ...customers.map(c => ({ id: c._id, role: 'customer', name: c.name, mobile: c.mobile })),
        ...partners.map(p => ({ id: p._id, role: 'partner', name: p.ownerName, mobile: p.mobile })),
        ...sewaks.map(p => ({ id: p._id, role: 'sewak', name: p.ownerName, mobile: p.mobile }))
    ];
};

// @desc    Broadcast a push/in-app notification to all or specific users
// @route   POST /api/admin/broadcast/notification
const sendNotificationBroadcast = async (req, res) => {
    try {
        const { title, message, targetType, recipients } = req.body;
        if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });
        if (!targetType) return res.status(400).json({ message: 'targetType is required' });

        const audience = await resolveAudience(targetType, recipients);
        if (audience.length === 0) return res.status(400).json({ message: 'No recipients matched this target' });

        let successCount = 0;
        let failCount = 0;

        for (const person of audience) {
            try {
                const result = await notifyUser({
                    userId: person.id,
                    userRole: person.role === 'customer' ? 'user' : 'provider',
                    title,
                    message,
                    type: 'broadcast'
                });
                if (result) successCount++; else failCount++;
            } catch (err) {
                failCount++;
            }
        }

        const log = await Broadcast.create({
            channel: 'notification',
            title,
            message,
            targetType,
            recipientCount: audience.length,
            successCount,
            failCount,
            sentBy: req.user._id
        });

        res.json({ success: true, message: `Notification sent to ${successCount} of ${audience.length} recipients`, data: log });
    } catch (error) {
        console.error('Broadcast Notification Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Broadcast a WhatsApp message to all or specific users
// @route   POST /api/admin/broadcast/whatsapp
const sendWhatsAppBroadcast = async (req, res) => {
    try {
        const { message, targetType, recipients } = req.body;
        if (!message) return res.status(400).json({ message: 'Message is required' });
        if (!targetType) return res.status(400).json({ message: 'targetType is required' });

        const audience = await resolveAudience(targetType, recipients);
        if (audience.length === 0) return res.status(400).json({ message: 'No recipients matched this target' });

        let successCount = 0;
        let failCount = 0;

        for (const person of audience) {
            const result = await sendWhatsAppMessage(person.mobile, message);
            if (result.success) successCount++; else failCount++;
        }

        const log = await Broadcast.create({
            channel: 'whatsapp',
            message,
            targetType,
            recipientCount: audience.length,
            successCount,
            failCount,
            sentBy: req.user._id
        });

        res.json({ success: true, message: `WhatsApp sent to ${successCount} of ${audience.length} recipients`, data: log });
    } catch (error) {
        console.error('Broadcast WhatsApp Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Recent broadcast history
// @route   GET /api/admin/broadcast/history
const getBroadcastHistory = async (req, res) => {
    try {
        const history = await Broadcast.find()
            .populate('sentBy', 'name')
            .sort({ createdAt: -1 })
            .limit(50);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    searchRecipients,
    getAudienceCounts,
    sendNotificationBroadcast,
    sendWhatsAppBroadcast,
    getBroadcastHistory
};
