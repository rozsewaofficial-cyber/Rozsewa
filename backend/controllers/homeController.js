const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Coupon = require('../models/Coupon');
const Zone = require('../models/Zone');
const Combo = require('../models/Combo');

// @desc    Get all active zones/cities
// @route   GET /api/public/zones
// @access  Public
const getPublicZones = async (req, res) => {
    try {
        const zones = await Zone.find({ isActive: true }).sort({ name: 1 });
        res.json(zones);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all active banners for home page
// @route   GET /api/public/banners
// @access  Public
const getPublicBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ active: true }).sort({ priority: -1 });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single category by name
// @route   GET /api/public/categories/:name
// @access  Public
const getPublicCategoryByName = async (req, res) => {
    try {
        console.log(`[getPublicCategoryByName] Requested: "${req.params.name}"`);
        // Use regex for case-insensitive match and to handle potential trailing/leading spaces in the DB
        const safeName = req.params.name.trim().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const category = await Category.findOne({
            name: { $regex: new RegExp(`^\\s*${safeName}\\s*$`, 'i') }
        });

        if (!category) {
            console.log(`[getPublicCategoryByName] Not found: "${req.params.name}"`);
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        console.error(`[getPublicCategoryByName] Error:`, error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all active categories
// @route   GET /api/public/categories
// @access  Public
const getPublicCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ name: 1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single provider by ID
// @route   GET /api/public/providers/:id
// @access  Public
const getPublicProviderById = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id)
            .select('name shopName ownerName mobile profileImage vendorType vendorCode rating joins reviews status joinedDate reviewCount address location about qualifications warranty isOnline openingTime closingTime availability')
            .populate('vendorType', 'name icon');

        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }
        const activeBookings = await require('../models/Booking').find({
            providerId: provider._id,
            status: { $in: ['pending', 'confirmed', 'on_the_way', 'started'] }
        }).select('bookingDate bookingTime serviceId');

        const Service = require('../models/Service');
        const bookedSlots = [];
        for (const b of activeBookings) {
            let duration = 30; // default 30 mins
            if (b.serviceId && b.serviceId.length === 24) {
                try {
                    const s = await Service.findById(b.serviceId);
                    if (s && s.duration) {
                        duration = parseInt(s.duration) || 30;
                    }
                } catch (err) { }
            }
            bookedSlots.push({ date: b.bookingDate, time: b.bookingTime, duration });
        }

        const providerData = provider.toObject();
        providerData.bookedSlots = bookedSlots;

        res.json(providerData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get featured providers for home page
// @route   GET /api/public/featured-providers
// @access  Public
const getFeaturedProviders = async (req, res) => {
    try {
        const { lat, lng, city, radius = 15 } = req.query;
        let query = { status: 'verified', isOnline: true, providerCategory: { $ne: 'sewak' } };

        if (lat && lng) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius) * 1000
                }
            };
        } else if (city) {
            query.city = { $regex: new RegExp('^' + city.split(' ')[0], 'i') };
        }

        let providersQuery = Provider.find(query)
            .select('name shopName mobile profileImage vendorType vendorCode rating joinedDate reviewCount location')
            .populate('vendorType', 'name icon')
            .limit(8);

        if (!(lat && lng)) {
            providersQuery = providersQuery.sort({ rating: -1 });
        }

        const providers = await providersQuery;
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all providers for user list
// @route   GET /api/public/providers
// @access  Public
const getPublicProviders = async (req, res) => {
    try {
        const { category, search, lat, lng, city, radius = 15, mode, minRating, homeVisit, is24x7, hasCombo } = req.query;
        let query = { status: 'verified', isOnline: true };

        if (mode === 'sewak') {
            query.providerCategory = 'sewak';
        } else if (mode === 'partner') {
            query.providerCategory = 'partner';
        } else {
            query.providerCategory = 'partner';
        }

        if (minRating) {
            query.rating = { $gte: parseFloat(minRating) };
        }
        if (homeVisit === 'true') {
            query.isHomeVisitAvailable = true;
        }
        if (is24x7 === 'true') {
            query.is24x7 = true;
        }

        // Geolocation filtering
        if (lat && lng) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(radius) * 1000 // Convert km to meters
                }
            };
        } else if (city) {
            query.city = { $regex: new RegExp('^' + city.split(' ')[0], 'i') };
        }

        if (category) {
            const cat = await Category.findOne({ name: { $regex: new RegExp('^' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
            if (cat) query.vendorType = cat._id;
        }

        if (search) {
            const matchingServices = await Service.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            }).select('providerId');

            const serviceProviderIds = matchingServices.map(s => s.providerId);

            query.$or = [
                { shopName: { $regex: search, $options: 'i' } },
                { ownerName: { $regex: search, $options: 'i' } },
                { _id: { $in: serviceProviderIds } }
            ];
        }

        let providersQuery = Provider.find(query)
            .select('name shopName mobile profileImage vendorType vendorCode rating joins reviews status joinedDate reviewCount address location isHomeVisitAvailable is24x7 isEmergencyEnabled')
            .populate('vendorType', 'name icon services');

        if (!(lat && lng)) {
            providersQuery = providersQuery.sort({ rating: -1 });
        }

        const providerDocs = await providersQuery;

        // Fetch starting price and combo info for each provider
        const enrichedProviders = [];
        for (const p of providerDocs) {
            const providerObj = p.toObject();

            const isSewak = p.providerCategory === 'sewak';
            let startingPrice = 199;
            if (isSewak) {
                const categoryServices = p.vendorType?.services || [];
                if (categoryServices.length > 0) {
                    startingPrice = Math.min(...categoryServices.map(s => s.basePrice || 299));
                }
            } else {
                const services = await Service.find({ providerId: p._id, visible: true }).select('price');
                if (services.length > 0) {
                    startingPrice = Math.min(...services.map(s => s.price));
                }
            }
            providerObj.startingPrice = startingPrice;

            const combos = await Combo.find({ providerId: p._id, isActive: true }).select('_id');
            providerObj.hasCombo = combos.length > 0;

            if (hasCombo === 'true' && !providerObj.hasCombo) {
                continue; // Skip if filter requires combo and provider has none
            }

            enrichedProviders.push(providerObj);
        }

        res.json(enrichedProviders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Setting = require('../models/Setting');

// @desc    Get public configuration (e.g. registration price)
// @route   GET /api/public/config
// @access  Public
const getPublicConfig = async (req, res) => {
    try {
        const settings = await Setting.find({
            key: { $in: ['vendorCardEnabled', 'vendorCardPrice', 'supportNumber', 'max_bargain_discount_limit', 'distance_charge_config'] }
        });

        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        res.json({
            registrationEnabled: config.vendorCardEnabled !== undefined ? config.vendorCardEnabled : true,
            registrationPrice: config.vendorCardPrice || 99,
            currency: "INR",
            supportNumber: config.supportNumber || "91XXXXXXXXXX",
            maxBargainLimit: config.max_bargain_discount_limit !== undefined ? Number(config.max_bargain_discount_limit) : 20,
            distanceCharge: config.distance_charge_config || { enabled: false, fallbackCharge: 40 }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get services for a specific provider
// @route   GET /api/public/services/:providerId
// @access  Public
const getPublicServiceByProvider = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.providerId).populate('vendorType');
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        const isSewak = provider.providerCategory === 'sewak';
        let services = [];
        let combos = [];

        if (isSewak) {
            const categoryServices = provider.vendorType?.services || [];
            const categoryCombos = provider.vendorType?.combos || [];
            const categoryName = provider.vendorType?.name || 'Category';

            services = categoryServices.map(catSvc => ({
                _id: catSvc._id,
                name: catSvc.name,
                description: catSvc.description || `Professional ${catSvc.name} service`,
                duration: "1 hour",
                visible: true,
                category: categoryName,
                price: catSvc.basePrice ?? 299
            }));

            combos = categoryCombos.map(catCombo => ({
                _id: catCombo._id,
                name: catCombo.name,
                description: catCombo.description,
                price: catCombo.sewakPrice || 0,
                image: catCombo.image,
                services: catCombo.services.map(svcName => {
                    const s = services.find(s => s.name === svcName);
                    return s || { name: svcName };
                })
            }));
        } else {
            services = await Service.find({ providerId: req.params.providerId, visible: true });
            combos = await Combo.find({
                providerId: req.params.providerId,
                isActive: true,
                $or: [{ status: 'approved' }, { status: { $exists: false } }]
            }).populate('services');
        }

        res.json({ services, combos });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all active coupons
// @route   GET /api/public/coupons
// @access  Public
const getPublicCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ isActive: true, expiryDate: { $gt: new Date() } })
            .populate('targetCategory', 'name');
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Validate a coupon code
// @route   POST /api/public/coupons/validate
// @access  Public
const validateCoupon = async (req, res) => {
    try {
        const { code, amount, serviceId } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true }).populate('targetCategory');

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid coupon code' });
        }

        if (new Date() > coupon.expiryDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        if (coupon.usageCount >= coupon.maxUsage) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        if (amount < coupon.minOrderAmount) {
            return res.status(400).json({ message: `Minimum order amount for this coupon is ₹${coupon.minOrderAmount}` });
        }

        // Validate Category Restriction
        if (coupon.targetCategory && serviceId) {
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(serviceId)) {
                const Service = require('../models/Service');
                const Combo = require('../models/Combo');
                const Category = require('../models/Category');

                let belongsToCategory = false;
                
                // 1. Check if it's a regular service
                const service = await Service.findById(serviceId);
                if (service) {
                    const category = await Category.findOne({ name: service.category });
                    if (category && category._id.toString() === coupon.targetCategory._id.toString()) {
                        belongsToCategory = true;
                    }
                }

                // 2. Check if it's a combo
                if (!belongsToCategory) {
                    const combo = await Combo.findById(serviceId);
                    if (combo) {
                        // Assuming combos might belong to categories, or just deny if strict
                        // In this system, combos are usually attached to providers or categories
                        // We will check if any of the combo's services belong to the category
                        // For simplicity, we might just allow combos if they have services in that category
                        // Let's check provider's vendorType (which is category)
                        const provider = await Provider.findById(combo.providerId);
                        if (provider && provider.vendorType.toString() === coupon.targetCategory._id.toString()) {
                            belongsToCategory = true;
                        }
                    }
                }

                // 3. Check if it's a category sub-service (Sewak)
                if (!belongsToCategory) {
                    const category = await Category.findOne({
                        $or: [
                            { "services._id": serviceId },
                            { "combos._id": serviceId }
                        ]
                    });
                    if (category && category._id.toString() === coupon.targetCategory._id.toString()) {
                        belongsToCategory = true;
                    }
                }

                if (!belongsToCategory) {
                    return res.status(400).json({ message: `This coupon is only valid for ${coupon.targetCategory.name} services.` });
                }
            }
        }

        res.json(coupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyReferralCode = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) return res.status(400).json({ message: 'Code is required' });

        // Check Providers first
        const provider = await Provider.findOne({ vendorCode: code.toUpperCase() });
        if (provider) {
            return res.json({ name: provider.ownerName, type: 'vendor' });
        }

        // Check Employees
        const employee = await Employee.findOne({ employeeId: code.toUpperCase() });
        if (employee) {
            return res.json({ name: employee.name, type: 'employee' });
        }

        res.status(404).json({ message: 'Invalid referral code' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPublicBanners,
    getPublicCategories,
    getFeaturedProviders,
    getPublicProviders,
    getPublicConfig,
    getPublicServiceByProvider,
    getPublicProviderById,
    getPublicCategoryByName,
    getPublicCoupons,
    validateCoupon,
    verifyReferralCode,
    getPublicZones
};
