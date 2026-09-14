const { pageParams, paginate } = require('../utils/pagination');
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
// @route POST /api/provider/banners/wallet
// @desc Create a new banner request paying via Wallet
exports.createBannerWithWallet = async (req, res) => {
    try {
        const { planType, locationValue, durationDays, bannerSource, designDescription, imageUrl, pricePaid } = req.body;
        
        const { Wallet, Transaction } = require('../models/Wallet');
        
        // 1. Check wallet availableBalance
        const wallet = await Wallet.findOne({ providerId: req.user.id });
        if (!wallet || wallet.availableBalance < pricePaid) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet available balance.' });
        }

        // 2. Deduct from wallet availableBalance
        wallet.availableBalance -= pricePaid;
        await wallet.save();

        // 3. Create Transaction record
        const transaction = new Transaction({
            providerId: req.user.id,
            title: 'Banner Promotion Purchase',
            amount: pricePaid,
            type: 'debit',
            status: 'completed',
            description: `Purchased ${planType} banner for ${durationDays} days.`
        });
        await transaction.save();

        // 4. Create Banner Request
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
            paymentId: `WALLET_${transaction._id}`,
            status
        });

        await banner.save();
        res.status(201).json({ success: true, banner, balance: wallet.balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// @route GET /api/provider/banners
// @desc Get all banners for logged in provider
exports.getMyBanners = async (req, res) => {
    try {
        // A banner expires because of the clock, not because someone looked at
        // it. One write for all of them, rather than a save per banner followed
        // by reading the whole list a second time.
        await ProviderBanner.updateMany(
            { provider: req.user.id, status: 'Active', endDate: { $lt: new Date() } },
            { $set: { status: 'Expired' } }
        );

        // Expired banners are excluded by the query rather than by filtering
        // them back out of what was loaded.
        const scope = { provider: req.user.id, status: { $ne: 'Expired' } };
        const [total, banners] = await Promise.all([
            ProviderBanner.countDocuments(scope),
            paginate(ProviderBanner.find(scope).sort({ createdAt: -1 }), pageParams(req))
        ]);

        res.json({ success: true, total, banners });
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
        // Same as above: expiry is a single write, not a save per row.
        await ProviderBanner.updateMany(
            { status: 'Active', endDate: { $lt: new Date() } },
            { $set: { status: 'Expired' } }
        );

        const scope = req.query.status ? { status: req.query.status } : {};
        const [total, banners] = await Promise.all([
            ProviderBanner.countDocuments(scope),
            paginate(
                ProviderBanner.find(scope)
                    .populate('provider', 'ownerName shopName mobile vendorCode address city state')
                    .sort({ createdAt: -1 }),
                pageParams(req)
            )
        ]);

        res.json({ success: true, total, banners });
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
        if (city) locationConditions.push({ planType: 'City', locationValue: { $regex: new RegExp(`^${city}$`, 'i') } });
        if (district) locationConditions.push({ planType: 'District', locationValue: { $regex: new RegExp(`^${district}$`, 'i') } });
        if (state) locationConditions.push({ planType: 'State', locationValue: { $regex: new RegExp(`^${state}$`, 'i') } });

        query.$or = locationConditions;

        // A carousel shows a handful; there is no reason to load every banner
        // running in a city to fill it.
        const banners = await ProviderBanner.find(query)
            .populate('provider', 'name businessName profileImage rating')
            .sort({ planType: -1 }) // Priority to Premium Top, etc.
            .limit(Math.min(100, Math.max(1, Number(req.query.limit) || 50)));

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
