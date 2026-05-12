const Offer = require('../models/Offer');

// @desc    Get all offers for logged in provider
// @route   GET /api/provider/offers
// @access  Private (Provider)
const getProviderOffers = async (req, res) => {
    try {
        const offers = await Offer.find({ providerId: req.user._id }).sort({ createdAt: -1 });
        res.json(offers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new offer
// @route   POST /api/provider/offers
// @access  Private (Provider)
const createProviderOffer = async (req, res) => {
    const { title, type, value, expiry } = req.body;

    try {
        const offer = await Offer.create({
            providerId: req.user._id,
            title,
            type,
            value,
            expiry,
            status: 'Pending' // Always pending when created by provider
        });

        // Push Notification for Admins (New Offer Request)
        try {
            const User = require('../models/User');
            const { sendNotificationToUser } = require('../config/notificationService');
            
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            
            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title: 'New Offer Request',
                    body: `Provider ${req.user.ownerName} created a new offer: "${title}". Review now.`,
                    data: {
                        type: 'offer',
                        id: offer._id.toString(),
                        link: '/admin/offers'
                    }
                });
            }
        } catch (err) {
            console.log('Admin push notification failed (skipping):', err.message);
        }

        res.status(201).json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProviderOffers,
    createProviderOffer
};
