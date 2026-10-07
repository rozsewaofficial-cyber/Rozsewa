const DistanceChargeService = require('../services/DistanceChargeService');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Coupon = require('../models/Coupon');
const Zone = require('../models/Zone');
const Combo = require('../models/Combo');
const Subcategory = require('../models/Subcategory');
const ProviderBanner = require('../models/ProviderBanner');
const { serviceScopeFor, comboInScope, serviceNameKey } = require('../utils/providerServiceScope');
const mongoose = require('mongoose');

// A provider's working hours (Provider.availability, set from
// ProviderAvailability.jsx) are entered in IST regardless of where the
// server itself runs, so "current time" for this check is always computed
// in Asia/Kolkata rather than the server's local/UTC clock.
const getIstDayAndTime = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(new Date());
    const day = parts.find(p => p.type === 'weekday').value;
    let hour = parts.find(p => p.type === 'hour').value;
    if (hour === '24') hour = '00'; // Intl quirk: midnight can come back as "24:00"
    const minute = parts.find(p => p.type === 'minute').value;
    return { day, time: `${hour}:${minute}` };
};

// Whether a provider is inside the working hours they configured — a
// provider who set "9 to 12" showed up in listings at 1pm and every other
// hour, because isOnline is a manual switch the provider has to remember to
// flip and nothing ever checked their schedule against the clock.
//
// A provider who has never opened the Availability screen has an empty
// availability array — that must still show them (today's default), not
// hide every provider who never touched the setting.
//
// Round-the-clock is one setting stored in two fields: the Timing screen's
// "24/7 Emergency" switch writes is24x7, while the Settings "24/7 Service"
// tile and the dashboard Emergency button write isEmergencyEnabled. Older
// partners may have only one of them set, so either one counts.
const isProviderWithinWorkingHours = (provider) => {
    if (provider.is24x7 || provider.isEmergencyEnabled) return true;
    if (!provider.availability || provider.availability.length === 0) return true;

    const { day, time } = getIstDayAndTime();
    const todayEntry = provider.availability.find(a => a.day === day);
    if (!todayEntry) return true; // no entry for today — fail open, not closed

    if (todayEntry.isActive === false) return false;
    return time >= todayEntry.startTime && time <= todayEntry.endTime;
};

/** Escapes a string so it can be used as a literal inside a RegExp. */
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The services a customer can book from a category in Sewak mode.
//
// Sewak screens read the copy embedded in Category.services, while the admin
// catalog (and Local Expert mode) is the standalone Service documents. The copy
// drifts: a service moved to another category, or one that never made it into
// the embedded list, shows to partners but is missing for Sewak customers. So
// the catalog rows of this category are merged in, and each entry carries its
// subcategory so the page can group services by it. A Sewak booking prices a
// catalog-only row from Service.price (bookingController's fallback lookup).
//
// Only priced rows are bookable at a fixed Sewak rate, and a row the admin
// marked Partner-only stays out of Sewak mode.
const sewakCatalogServices = async (cat) => {
    const forSewak = (s) => s.visibleTo !== 'partner';
    const catalog = await Service.find({ categoryId: cat._id, providerId: null })
        .select('name description price image subcategoryId subcategory visibleTo visible')
        .lean();
    const catalogById = new Map(catalog.map(s => [String(s._id), s]));
    const key = (name) => String(name || '').trim().toLowerCase();

    const embedded = (cat.services || [])
        .filter(s => (Number(s.basePrice) > 0 || Number(s.price) > 0) && forSewak(s))
        .map(s => {
            const doc = catalogById.get(String(s._id));
            // An image uploaded on the catalog row may never have reached the copy.
            return doc
                ? { ...s, image: s.image || doc.image || '', subcategoryId: doc.subcategoryId, subcategory: doc.subcategory }
                : s;
        });

    const seenIds = new Set((cat.services || []).map(s => String(s._id)));
    const seenNames = new Set((cat.services || []).map(s => key(s.name)));
    const missing = catalog
        .filter(s => !seenIds.has(String(s._id)) && !seenNames.has(key(s.name)))
        .filter(s => Number(s.price) > 0 && s.visible !== false && forSewak(s))
        .map(s => ({
            _id: s._id,
            name: s.name,
            basePrice: Number(s.price),
            description: s.description || '',
            image: s.image || '',
            subcategoryId: s.subcategoryId,
            subcategory: s.subcategory,
            visibleTo: s.visibleTo || 'both'
        }));

    return [...embedded, ...missing];
};

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
        // Switched on, and inside its schedule when it has one.
        const now = new Date();
        const banners = await Banner.find({
            active: true,
            $and: [
                { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
                { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
            ]
        }).sort({ priority: -1, createdAt: -1 });
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
        // Case-insensitive, tolerant of stray spaces in the stored name. The old
        // escape was itself mis-escaped and never escaped anything, so a name
        // with "(", ")" or "+" (e.g. "Cook + Maid") built a regex that could
        // not match its own category — the Sewak page got a 404 and no services.
        const category = await Category.findOne({
            name: { $regex: new RegExp(`^\\s*${escapeRegex(req.params.name.trim())}\\s*$`, 'i') }
        });

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const catObj = category.toObject();
        catObj.services = await sewakCatalogServices(catObj);
        res.json(catObj);
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
        // Same ordering the admin's own category list uses (adminController.js
        // getCategories) — the admin-configured `index`, not alphabetical. A-Z
        // buried whatever the admin actually wanted shown first.
        //
        // A "Coming Soon" category is disabled/greyed-out and un-tappable —
        // sorted purely by index it could still land first, pushing every
        // bookable category below a row of dead cards. isComingSoon sorts
        // ascending (false before true) so real categories always lead;
        // index still breaks ties within each group.
        let categories = await Category.find({ isActive: true }).sort({ isComingSoon: 1, index: 1 }).lean();

        // The customer app's Local Expert / Sewak toggle should only show
        // categories that provider type actually serves.
        const mode = req.query.mode === 'sewak' ? 'sewak' : (req.query.mode === 'partner' ? 'partner' : null);
        if (mode) {
            categories = categories.filter(c => !c.visibleTo || c.visibleTo === 'both' || c.visibleTo === mode);
        }

        const result = categories.map(cat => ({
            ...cat,
            services: (cat.services || []).filter(s => Number(s.basePrice) > 0 || Number(s.price) > 0)
        }));
        res.json(result);
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
            .select('name shopName ownerName providerCategory mobile profileImage vendorType vendorCode rating joins reviews status joinedDate reviewCount address location about qualifications warranty isOnline openingTime closingTime availability is24x7 isEmergencyEnabled isHomeVisitAvailable razorpayDisabled')
            .populate('vendorType', 'name icon hasNightCharge nightChargePercent nightChargeFlatAmount');

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
        // The listing endpoints already hide a provider outside their
        // configured hours — but a direct link (shared, bookmarked, or from
        // Favorites) bypasses that filter entirely. The profile itself still
        // loads; this just tells the frontend whether to show it as closed.
        providerData.isWithinWorkingHours = isProviderWithinWorkingHours(provider);
        // Customers see only that online payment is off for this provider.
        providerData.onlinePaymentDisabled = !!provider.razorpayDisabled;
        delete providerData.razorpayDisabled;

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
            .select('name shopName providerCategory mobile profileImage vendorType vendorCode rating joinedDate reviewCount location availability is24x7 isEmergencyEnabled')
            .populate('vendorType', 'name icon')
            .limit(40);

        if (!(lat && lng)) {
            providersQuery = providersQuery.sort({ rating: -1 });
        }

        const providers = (await providersQuery)
            .filter(isProviderWithinWorkingHours)
            .slice(0, 8);
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
        const { category, search, lat, lng, city, radius = 15, mode, minRating, homeVisit, is24x7, hasCombo, storeVisitOnly, emergency, serviceId, serviceName } = req.query;
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
        if (storeVisitOnly === 'true') {
            // A provider who never turned Home Visit on only serves customers
            // who come to their shop — that's what "Store Visit Only" means.
            query.isHomeVisitAvailable = { $ne: true };
        }
        const andClauses = [];
        if (is24x7 === 'true') {
            // The Settings "24/7 SERVICE" tile sets isEmergencyEnabled while the
            // Timing screen sets is24x7 — either one means round-the-clock.
            andClauses.push({ $or: [{ is24x7: true }, { isEmergencyEnabled: true }] });
        }
        // The service the customer picked (category -> subcategory -> service).
        // Sewaks are matched on their picked list; a partner further down by
        // the services it actually offers.
        let wantedService = null;
        if (serviceId || serviceName) {
            if (mode === 'sewak') {
                const wanted = [serviceId, serviceName].filter(Boolean);
                andClauses.push({ $or: [{ subServices: { $in: wanted } }, { subServices: { $exists: false } }, { subServices: { $size: 0 } }] });
            } else {
                let name = serviceName;
                if (!name && mongoose.Types.ObjectId.isValid(serviceId)) {
                    // A catalog row, or an entry kept on the category itself.
                    name = (await Service.findById(serviceId).select('name').lean())?.name;
                    if (!name) {
                        const owner = await Category.findOne({ 'services._id': serviceId }).select('services').lean();
                        name = owner?.services?.find(s => String(s._id) === String(serviceId))?.name;
                    }
                }
                wantedService = { id: serviceId ? String(serviceId) : null, key: serviceNameKey(name) };
            }
        }
        if (emergency === 'true') {
            andClauses.push({ $or: [{ is24x7: true }, { isEmergencyEnabled: true }] });
        }
        if (andClauses.length) query.$and = andClauses;

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
            const searchRx = { $regex: search, $options: 'i' };

            // Providers only ever get matched two ways: their own shop/owner
            // name, or a Service they personally created on their profile.
            // Neither one touches the admin-defined category catalog, so a
            // brand-new category (or a sub-service in it) was invisible to
            // search until some provider happened to type the same word into
            // their own shop name — "Electrician" existing as a category was
            // not enough to find an Electrician provider by that word.
            // A subcategory (e.g. "Hair Care & Styling") lives only in its own
            // collection — matching just Service names and the category
            // catalog left it invisible, even though it groups real,
            // bookable services. Resolving it to its parent category surfaces
            // the same providers a direct category search already would.
            const [matchingServices, matchingCategories, matchingSubcategories] = await Promise.all([
                Service.find({ $or: [{ name: searchRx }, { description: searchRx }] }).select('providerId'),
                Category.find({ $or: [{ name: searchRx }, { 'services.name': searchRx }] }).select('_id'),
                Subcategory.find({ name: searchRx }).select('categoryId')
            ]);

            const serviceProviderIds = matchingServices.map(s => s.providerId);
            const matchingCategoryIds = [
                ...matchingCategories.map(c => c._id),
                ...matchingSubcategories.map(s => s.categoryId)
            ];

            query.$or = [
                { shopName: searchRx },
                { ownerName: searchRx },
                { _id: { $in: serviceProviderIds } },
                { vendorType: { $in: matchingCategoryIds } }
            ];
        }

        let providersQuery = Provider.find(query)
            .select('name shopName providerCategory mobile profileImage vendorType vendorCode rating joins reviews status joinedDate reviewCount address location isHomeVisitAvailable is24x7 isEmergencyEnabled availability subServices')
            .populate('vendorType', 'name icon services');

        if (!(lat && lng)) {
            providersQuery = providersQuery.sort({ rating: -1 });
        }

        const providerDocs = await providersQuery;

        // Fetch starting price and combo info for each provider
        const enrichedProviders = [];
        for (const p of providerDocs) {
            if (!isProviderWithinWorkingHours(p)) {
                continue; // "9 to 12" means gone from listings the rest of the day, not just greyed out
            }

            const providerObj = p.toObject();

            const isSewak = p.providerCategory === 'sewak';
            let startingPrice = 199;
            let hasAnyServices = true;
            
            if (isSewak) {
                const categoryServices = p.vendorType?.services || [];
                if (categoryServices.length > 0) {
                    startingPrice = Math.min(...categoryServices.map(s => s.basePrice || 299));
                }
            } else {
                const offers = serviceScopeFor(p, p.vendorType?.services);
                const services = (await Service.find({ providerId: p._id, visible: true }).select('name price'))
                    .filter(s => !offers || offers(s));

                if (wantedService) {
                    // Listed for a service only when the partner offers it: a
                    // priced service of its own with that name. Going by the
                    // picked list alone listed every partner under every
                    // service — an empty list means "the whole category", and
                    // old admin category edits had filled every partner's list
                    // with all of the category's services.
                    const offered = services.find(s =>
                        String(s._id) === wantedService.id
                        || (wantedService.key && serviceNameKey(s.name) === wantedService.key));
                    if (!offered) continue;
                    startingPrice = Number(offered.price) || startingPrice;
                    providerObj.matchedService = { _id: offered._id, name: offered.name, price: offered.price };
                } else if (services.length > 0) {
                    startingPrice = Math.min(...services.map(s => s.price));
                } else {
                    hasAnyServices = false;
                }
            }
            providerObj.startingPrice = startingPrice;

            const combos = await Combo.find({ providerId: p._id, isActive: true }).select('_id');
            providerObj.hasCombo = combos.length > 0;

            if (hasCombo === 'true' && !providerObj.hasCombo) {
                continue; // Skip if filter requires combo and provider has none
            }

            // Skip non-sewak providers that have no services and no combos
            if (!isSewak && !hasAnyServices && !providerObj.hasCombo) {
                continue;
            }

            enrichedProviders.push(providerObj);
        }

        // Partners with a banner running for THIS customer's location are
        // listed first. Only banners of the partners in this result are read,
        // and only ones inside their dates: a banner bought for another city
        // or state no longer boosts anyone here.
        const BannerService = require('../services/BannerService');
        const place = BannerService.customerPlace({
            pincode: req.query.pincode,
            city,
            district: req.query.district,
            state: req.query.state
        });
        const runningBanners = enrichedProviders.length
            ? await ProviderBanner.find({
                ...BannerService.liveFilter(),
                provider: { $in: enrichedProviders.map(p => p._id) }
            }).select('provider planType locationValue locationKey').lean()
            : [];
        const boostedProviderIds = new Set(
            runningBanners.filter(b => BannerService.bannerTargets(b, place)).map(b => b.provider.toString())
        );

        enrichedProviders.sort((a, b) => {
            const aBoosted = boostedProviderIds.has(a._id.toString()) ? 1 : 0;
            const bBoosted = boostedProviderIds.has(b._id.toString()) ? 1 : 0;
            if (aBoosted !== bBoosted) {
                return bBoosted - aBoosted; // Boosted first
            }
            // Fallback to original order (which is distance or rating)
            return 0;
        });

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
            key: { $in: ['vendorCardEnabled', 'vendorCardPrice', 'supportNumber', 'distance_charge_config', 'night_charge_config'] }
        });

        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        res.json({
            registrationEnabled: config.vendorCardEnabled !== undefined ? config.vendorCardEnabled : true,
            registrationPrice: config.vendorCardPrice || 99,
            currency: "INR",
            supportNumber: config.supportNumber || "91XXXXXXXXXX",
            // Read through the same service that actually applies the charge.
            // These were two separate defaults for one setting: with no config
            // row saved, this said disabled while booking creation said enabled,
            // so a customer was charged a travel fee the checkout never showed.
            distanceCharge: await DistanceChargeService.getConfig(),
            nightCharge: {
                enabled: false,
                chargeType: 'percent',
                defaultPercent: 10,
                defaultFlatAmount: 0,
                applyToPartner: true,
                applyToSewak: true,
                startTime: '21:00',
                endTime: '06:00',
                ...(config.night_charge_config || {})
            }
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
            const categoryServices = (provider.vendorType?.services || []).filter(s => Number(s.basePrice) > 0);
            const categoryCombos = provider.vendorType?.combos || [];
            const categoryName = provider.vendorType?.name || 'Category';

            services = categoryServices.map(catSvc => ({
                _id: catSvc._id,
                name: catSvc.name,
                description: catSvc.description || `Professional ${catSvc.name} service`,
                duration: "1 hour",
                visible: true,
                category: categoryName,
                price: Number(catSvc.basePrice)
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
            services = await Service.find({ providerId: req.params.providerId, visible: true, price: { $gt: 0 } });
            combos = await Combo.find({
                providerId: req.params.providerId,
                isActive: true,
                $or: [{ status: 'approved' }, { status: { $exists: false } }]
            }).populate('services');

            // Only what the partner chose to offer — picking one service must
            // not put the rest of the category on its shop page.
            const offers = serviceScopeFor(provider, provider.vendorType?.services);
            if (offers) {
                services = services.filter(offers);
                combos = combos.filter(c => comboInScope(offers, c));
            }
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
        const { code, amount, serviceId, providerId } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true }).populate('targetCategory');

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid coupon code' });
        }

        // A coupon scoped to Partner-only or Sewak-only must match the provider
        // this checkout is actually with, the same rule createBooking enforces
        // as the trusted final check.

        if (coupon.applicableTo && coupon.applicableTo !== 'both' && providerId && mongoose.Types.ObjectId.isValid(providerId)) {
            const provider = await Provider.findById(providerId).select('providerCategory');
            const isSewakBooking = provider?.providerCategory === 'sewak';
            if ((coupon.applicableTo === 'sewak') !== isSewakBooking) {
                return res.status(400).json({ message: `This coupon is only valid for ${coupon.applicableTo === 'sewak' ? 'Sewak' : 'Partner'} bookings.` });
            }
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


// @desc    Autocomplete suggestions across categories, subcategories and
//          services — the search box only ever suggested category names,
//          so typing an exact subcategory/service (e.g. "Haircut") showed
//          nothing to tap even though providers offering it do exist.
// @route   GET /api/public/search-suggestions?q=&mode=
// @access  Public
const escapeSearchRegex = (str) => (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPublicSearchSuggestions = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json([]);

        const mode = req.query.mode === 'sewak' ? 'sewak' : (req.query.mode === 'partner' ? 'partner' : null);
        const rx = { $regex: escapeSearchRegex(q), $options: 'i' };
        // visibleTo is only ever set on admin-curated rows; a missing/legacy
        // value must still be offered, not silently dropped from either mode.
        const modeFilter = mode ? { $or: [{ visibleTo: { $exists: false } }, { visibleTo: 'both' }, { visibleTo: mode }] } : {};

        const [categories, subcategories, services] = await Promise.all([
            Category.find({ isActive: true, name: rx, ...modeFilter }).select('name').limit(5).lean(),
            Subcategory.find({ isActive: true, name: rx, ...modeFilter }).select('name categoryId').populate('categoryId', 'name').limit(5).lean(),
            // categoryId is the reliable link — a Service can carry a stale/
            // blank legacy `category` string while its categoryId is correct
            // (or vice versa for very old rows), so resolve both and prefer
            // whichever one actually has a name.
            Service.find({ visible: true, name: rx, ...modeFilter }).select('name category subcategory categoryId').populate('categoryId', 'name').limit(5).lean()
        ]);

        const results = [
            ...categories.map(c => ({ type: 'category', name: c.name })),
            ...subcategories.map(s => ({ type: 'subcategory', name: s.name, categoryName: s.categoryId ? s.categoryId.name : '' })),
            ...services.map(s => ({ type: 'service', name: s.name, categoryName: (s.categoryId && s.categoryId.name) || s.category || '', subcategoryName: s.subcategory || '' }))
        ];

        // A service and a subcategory that happen to share a name (or a name
        // already covered by a category match) would otherwise show as two
        // near-identical rows for the same tap.
        const seen = new Set();
        const deduped = results.filter(r => {
            const key = r.name.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        res.json(deduped.slice(0, 10));
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
    getPublicZones,
    getPublicSearchSuggestions
};
