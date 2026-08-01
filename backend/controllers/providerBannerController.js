const ProviderBanner = require('../models/ProviderBanner');
const Provider = require('../models/Provider');

// --- Provider Routes ---

// @route POST /api/provider/banners
// @desc Create a new banner request
exports.createBannerRequest = async (req, res) => {
    try {
        const { planType, locationValue, durationDays, bannerSource, designDescription, imageUrl, pricePaid, paymentId } = req.body;
        
        let status = 'Pending Approval';
        if (bannerSource === 'Create Banner by RozSewa') {
            status = 'Banner Design Required';
        }

        const banner = new ProviderBanner({
            provider: req.user.id,
            planType,
            locationValue,
            durationDays,
            bannerSource,
            designDescription,
            imageUrl,
            pricePaid,
            paymentId,
            status
        });

        await banner.save();
        res.status(201).json({ success: true, banner });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @route GET /api/provider/banners
// @desc Get all banners for logged in provider
exports.getMyBanners = async (req, res) => {
    try {
        const banners = await ProviderBanner.find({ provider: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, banners });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- Admin Routes ---

// @route GET /api/admin/banners
// @desc Get all provider banners for admin review
exports.getAllBanners = async (req, res) => {
    try {
        const banners = await ProviderBanner.find()
            .populate('provider', 'ownerName shopName mobile vendorCode address city state')
            .sort({ createdAt: -1 });
        res.json({ success: true, banners });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @route PUT /api/admin/banners/:id/status
// @desc Update banner status and optionally attach design URL
exports.updateBannerStatus = async (req, res) => {
    try {
        const { status, imageUrl } = req.body;
        const banner = await ProviderBanner.findById(req.params.id);
        
        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

        banner.status = status;
        if (imageUrl) banner.imageUrl = imageUrl;

        // If approved and no startDate is set, start immediately (or based on some logic)
        if (status === 'Approved' && !banner.startDate) {
            banner.startDate = new Date();
            // Calculate end date based on duration
            const endDate = new Date(banner.startDate);
            endDate.setDate(endDate.getDate() + banner.durationDays);
            banner.endDate = endDate;
            banner.status = 'Active'; // Automatically active if startDate is today
        }

        await banner.save();
        res.json({ success: true, banner });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- Public / User Routes ---

// @route GET /api/banners/active
// @desc Get active banners based on location
exports.getActiveBannersByLocation = async (req, res) => {
    try {
        const { pincode, city, district, state } = req.query;

        // Base match for Active banners
        let query = {
            status: 'Active',
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        };

        // If location is provided, find banners that match the criteria OR are Premium Top
        let locationConditions = [
            { planType: 'Premium Top' }
        ];

        if (pincode) locationConditions.push({ planType: 'Local', locationValue: pincode });
        if (city) locationConditions.push({ planType: 'City', locationValue: city });
        if (district) locationConditions.push({ planType: 'District', locationValue: district });
        if (state) locationConditions.push({ planType: 'State', locationValue: state });

        query.$or = locationConditions;

        const banners = await ProviderBanner.find(query)
            .populate('provider', 'name businessName profileImage rating')
            .sort({ planType: -1 }); // Priority to Premium Top, etc.

        // Increment views for these banners
        if (banners.length > 0) {
            const bannerIds = banners.map(b => b._id);
            await ProviderBanner.updateMany(
                { _id: { $in: bannerIds } },
                { $inc: { 'analytics.views': 1 } }
            );
        }

        res.json({ success: true, banners });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @route POST /api/banners/:id/click
// @desc Track banner click
exports.trackClick = async (req, res) => {
    try {
        await ProviderBanner.findByIdAndUpdate(req.params.id, {
            $inc: { 'analytics.clicks': 1 }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// @route DELETE /api/admin/provider-banners/:id
// @desc Delete a provider banner request
exports.deleteBanner = async (req, res) => {
    try {
        const banner = await ProviderBanner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }
        await ProviderBanner.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
