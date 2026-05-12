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

        res.status(201).json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProviderOffers,
    createProviderOffer
};
