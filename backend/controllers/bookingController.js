const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Provider = require('../models/Provider');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { emitToProvider } = require('../config/socket');
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Category = require('../models/Category');
const Setting = require('../models/Setting');
const SewakIncentiveLog = require('../models/SewakIncentiveLog');
const Combo = require('../models/Combo');
const Coupon = require('../models/Coupon');

// Helper to check if time is within night window
const isNightTime = (timeStr, startStr, endStr) => {
    const toMinutes = (s) => {
        // Handle "HH:mm AM/PM" format or "HH:mm"
        const parts = s.split(' ');
        const [h_str, m_str] = parts[0].split(':');
        let h = parseInt(h_str);
        let m = parseInt(m_str);

        if (parts[1]) {
            const period = parts[1].toUpperCase();
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
        }
        return h * 60 + m;
    };

    try {
        const current = toMinutes(timeStr);
        const start = toMinutes(startStr);
        const end = toMinutes(endStr);

        if (start < end) {
            return current >= start && current <= end;
        } else {
            return current >= start || current <= end;
        }
    } catch (err) {
        return false;
    }
};

// Helper to check for schedule overlaps (30 mins before to 30 mins after)
const hasOverlap = async (providerId, bookingDate, bookingTime) => {
    try {
        if (!providerId || !bookingDate || !bookingTime) return false;

        const parseTime = (timeStr) => {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            if (hours === '12') hours = '00';
            if (modifier && modifier.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
            return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
        };

        const newTimeInMins = parseTime(bookingTime);
        const overlapStart = newTimeInMins - 30;
        const overlapEnd = newTimeInMins + 30;

        const bookingsOnDate = await Booking.find({
            providerId,
            bookingDate,
            status: { $in: ['confirmed', 'on_the_way', 'started'] }
        });

        for (let b of bookingsOnDate) {
            if (b.bookingTime) {
                const existingTimeInMins = parseTime(b.bookingTime);
                if (existingTimeInMins >= overlapStart && existingTimeInMins <= overlapEnd) {
                    return true;
                }
            }
        }
        return false;
    } catch (err) {
        console.error("Error checking overlap:", err);
        return false;
    }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
    const {
        providerId,
        serviceName,
        serviceId,
        bookingDate,
        bookingTime,
        totalAmount,
        address,
        couponCode,
        discountAmount,
        paymentMode,
        requiredProviderCategory,
        items = [],
        customerOffer
        , userProposedAmount } = req.body;

    try {
        // --- 1. Compute Trusted Subtotal on Backend ---
        let subtotal = 0;

        if (items && items.length > 0) {
            for (const item of items) {
                const itemId = item.id;
                const qty = Number(item.qty) || 1;
                let basePrice = 0;

                if (mongoose.Types.ObjectId.isValid(itemId)) {
                    // Check individual service
                    const service = await Service.findById(itemId);
                    if (service) {
                        basePrice = service.price || 0;
                    } else {
                        // Check combo
                        const combo = await Combo.findById(itemId);
                        if (combo) {
                            basePrice = combo.price || 0;
                        } else {
                            // Check sewak sub-service or combo under Category
                            const category = await Category.findOne({
                                $or: [
                                    { "services._id": itemId },
                                    { "combos._id": itemId }
                                ]
                            });
                            if (category) {
                                const subSvc = category.services.id(itemId);
                                if (subSvc) {
                                    basePrice = subSvc.basePrice || 0;
                                } else {
                                    const subCombo = category.combos.id(itemId);
                                    if (subCombo) {
                                        basePrice = subCombo.sewakPrice || 0;
                                    }
                                }
                            }
                        }
                    }
                }
                subtotal += basePrice * qty;
            }
        } else {
            // Fallback if no items passed: lookup single serviceId
            if (mongoose.Types.ObjectId.isValid(serviceId)) {
                const service = await Service.findById(serviceId);
                if (service) {
                    subtotal = service.price || 0;
                } else {
                    const combo = await Combo.findById(serviceId);
                    if (combo) {
                        subtotal = combo.price || 0;
                    } else {
                        const category = await Category.findOne({
                            $or: [
                                { "services._id": serviceId },
                                { "combos._id": serviceId }
                            ]
                        });
                        if (category) {
                            const subSvc = category.services.id(serviceId);
                            if (subSvc) {
                                subtotal = subSvc.basePrice || 0;
                            } else {
                                const subCombo = category.combos.id(serviceId);
                                if (subCombo) {
                                    subtotal = subCombo.sewakPrice || 0;
                                }
                            }
                        }
                    }
                }
            }
        }

        // Fallback if still 0
        if (subtotal === 0) {
            subtotal = Number(totalAmount) || 0;
        }

        // --- 2. Calculate Coupon Discount ---
        let couponDiscount = 0;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (coupon && new Date() <= coupon.expiryDate && coupon.usageCount < coupon.maxUsage && subtotal >= coupon.minOrderAmount) {
                if (coupon.discount.includes("%")) {
                    const percent = parseInt(coupon.discount);
                    couponDiscount = Math.round(subtotal * (percent / 100));
                } else {
                    couponDiscount = parseInt(coupon.discount.replace(/[^0-9]/g, "")) || 0;
                }
                if (coupon.maxDiscountAmount) {
                    couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
                }
                couponDiscount = Math.max(0, Math.min(couponDiscount, subtotal));
            }
        }

        // --- 3. Calculate Bargain Discount ---
        // Payable amount is customerOffer if provided, otherwise defaults to subtotal - couponDiscount
        const parsedCustomerOffer = customerOffer !== undefined && customerOffer !== null ? Number(customerOffer) : (subtotal - couponDiscount);
        const payableAmount = Math.max(0, parsedCustomerOffer);
        const bargainDiscount = Math.max(0, subtotal - couponDiscount - payableAmount);
        const totalDiscount = couponDiscount + bargainDiscount;

        // --- 4. Validate Maximum Discount Limit ---
        const limitConfig = await Setting.findOne({ key: 'max_bargain_discount_limit' });
        const limit = limitConfig && limitConfig.value !== undefined ? Number(limitConfig.value) : 20;

        const maxAllowedDiscount = Math.round(subtotal * (limit / 100));
        const minAllowedOfferAmount = Math.max(0, subtotal - maxAllowedDiscount);

        // Security check: discounts should not exceed subtotal, customerOffer should not be negative
        if (totalDiscount > maxAllowedDiscount || payableAmount < 0 || totalDiscount > subtotal || bargainDiscount < 0 || couponDiscount < 0) {
            // Log warning trace for rejected bargaining attempts
            console.warn(`[BARGAIN REJECTED] User ID: ${req.user._id}, Subtotal: ${subtotal}, Customer Offer: ${customerOffer}, Coupon Code: ${couponCode}, Total Discount: ${totalDiscount}, Configured Limit: ${limit}%`);
            return res.status(400).json({
                message: 'Customer Offer is too low.',
                minAllowedOffer: minAllowedOfferAmount,
                maxDiscountLimit: limit
            });
        }

        // --- 5. Calculate Night Charge & Express Fee ---
        let finalTotalAmount = payableAmount;
        let nightChargeAmount = 0;
        let appliedNightChargePercent = 0;

        try {
            const config = await Setting.findOne({ key: 'night_charge_config' });
            if (config && config.value.enabled) {
                const { startTime, endTime, defaultPercent } = config.value;

                if (isNightTime(bookingTime, startTime, endTime)) {
                    if (mongoose.Types.ObjectId.isValid(serviceId)) {
                        const service = await Service.findById(serviceId);
                        if (service) {
                            const category = await Category.findOne({ name: service.category });
                            let percent = defaultPercent;

                            if (category && category.hasNightCharge) {
                                percent = category.nightChargePercent;
                            }

                            appliedNightChargePercent = percent;
                            nightChargeAmount = (payableAmount * percent) / 100;
                            finalTotalAmount = payableAmount + nightChargeAmount;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Night charge calculation error:", err);
        }

        let originalFixedPrice = subtotal - couponDiscount;
        if (nightChargeAmount > 0 && appliedNightChargePercent > 0) {
            originalFixedPrice += (originalFixedPrice * appliedNightChargePercent) / 100;
        }
        originalFixedPrice = Math.round(originalFixedPrice);

        const newBooking = new Booking({
            userId: req.user._id,
            providerId,
            requiredProviderCategory: requiredProviderCategory || 'partner',
            serviceName,
            serviceId,
            bookingDate,
            bookingTime,
            totalAmount: finalTotalAmount,
            address,
            location: req.body.location,
            requiredProviderCategory: requiredProviderCategory || 'partner',
            couponCode,
            discountAmount: totalDiscount,
            customerOffer: customerOffer !== undefined && customerOffer !== null ? payableAmount : null,
            originalFixedPrice,
            bargainDiscount,
            couponDiscount,
            totalDiscount,
            paymentMode,
            extraCharges: nightChargeAmount > 0 ? [{ item: `Night Charge (${appliedNightChargePercent}%)`, amount: nightChargeAmount }] : []
        });

        if (booking) {
            console.log(`Booking Created: ID=${booking._id}, User=${req.user._id}`);

            // Radius-based dispatching (15km)
            const radiusInKm = 15;
            const radiusInRadians = radiusInKm / 6371;

            let providersToNotify = [];
            console.log('--- RADIUS DISPATCH DEBUG ---');
            console.log('Booking Location:', booking.location);

            if (providerId) {
                console.log(`Specific Provider requested: ${providerId}`);
                const specificProvider = await Provider.findById(providerId);
                if (specificProvider && specificProvider.status === 'verified' && specificProvider.isOnline) {
                    providersToNotify = [specificProvider];
                } else {
                    console.log(`Specific Provider ${providerId} is either not verified or offline.`);
                    // Fallback to finding other providers if the requested one is not available
                }
            }

            if (providersToNotify.length === 0) {
                const targetCategory = requiredProviderCategory || 'partner';

                if (!booking.location || !booking.location.coordinates || booking.location.coordinates.length < 2) {
                    console.log(`FAILED: Booking has no valid coordinates. Dispatching to ALL online ${targetCategory}s as fallback...`);
                    providersToNotify = await Provider.find({ status: 'verified', isOnline: true, providerCategory: targetCategory });
                } else {
                    const radiusInKm = targetCategory === 'sewak' ? 10 : 15;
                    const radiusInRadians = radiusInKm / 6371;

                    let preliminaryProviders = await Provider.find({
                        status: 'verified',
                        isOnline: true,
                        providerCategory: targetCategory,
                        location: {
                            $geoWithin: {
                                $centerSphere: [booking.location.coordinates, radiusInRadians]
                            }
                        }
                    });

                    if (preliminaryProviders.length > 0 && process.env.GOOGLE_MAPS_API_KEY) {
                        try {
                            const axios = require('axios');
                            const originStr = `${booking.location.coordinates[1]},${booking.location.coordinates[0]}`; // Lat,Lng
                            const maxDestinations = 25; // GMaps Distance Matrix limit
                            const providersToCheck = preliminaryProviders.slice(0, maxDestinations);

                            const destinationsStr = providersToCheck.map(p => {
                                if (p.location && p.location.coordinates && p.location.coordinates.length >= 2) {
                                    return `${p.location.coordinates[1]},${p.location.coordinates[0]}`;
                                }
                                return '';
                            }).filter(s => s !== '').join('|');

                            if (destinationsStr) {
                                const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destinationsStr}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
                                const response = await axios.get(url);

                                if (response.data && response.data.status === 'OK' && response.data.rows && response.data.rows.length > 0) {
                                    const elements = response.data.rows[0].elements;
                                    providersToNotify = [];

                                    providersToCheck.forEach((p, index) => {
                                        const element = elements[index];
                                        if (element && element.status === 'OK') {
                                            const distanceInMeters = element.distance.value;
                                            if (distanceInMeters <= radiusInKm * 1000) {
                                                providersToNotify.push(p);
                                            }
                                        } else {
                                            providersToNotify.push(p); // Fallback keep if individual calculation fails
                                        }
                                    });
                                } else {
                                    providersToNotify = preliminaryProviders; // Fallback keep all if API fails
                                }
                            } else {
                                providersToNotify = preliminaryProviders;
                            }
                        } catch (err) {
                            console.error('Google Maps Distance Matrix API Error:', err.message);
                            providersToNotify = preliminaryProviders;
                        }
                    } else {
                        providersToNotify = preliminaryProviders;
                    }
                }
            }

            console.log(`Providers Found: ${providersToNotify.length}`);

            // Filter out providers who have exceeded their cash limit
            const { Wallet } = require('../models/Wallet');
            const Setting = require('../models/Setting');
            const configSetting = await Setting.findOne({ key: 'cash_limits_config' });
            let cfg = { defaultLimit: 1500, categoryLimits: [], serviceLimits: [] };
            if (configSetting && configSetting.value) {
                cfg = configSetting.value;
            }

            const bookingServiceId = booking.serviceId ? booking.serviceId.toString() : (booking.services && booking.services.length > 0 ? booking.services[0].serviceId?.toString() : null);

            let serviceLimitOverride = null;
            if (bookingServiceId) {
                const srvLimitObj = cfg.serviceLimits?.find(s => s.serviceId === bookingServiceId);
                if (srvLimitObj) serviceLimitOverride = Number(srvLimitObj.limit);
            }

            const validProviders = [];
            for (const provider of providersToNotify) {
                let limit = serviceLimitOverride !== null ? serviceLimitOverride : (Number(cfg.defaultLimit) || 1500);

                if (serviceLimitOverride === null && provider.vendorType) {
                    const catId = provider.vendorType.toString();
                    const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
                    if (catLimitObj) limit = Number(catLimitObj.limit);
                }

                const wallet = await Wallet.findOne({ providerId: provider._id });
                if (wallet && wallet.balance <= -limit) {
                    console.log(`[Debt Enforcement] Provider ${provider._id} blocked from receiving booking (Balance: ${wallet.balance}, Limit: -${limit})`);
                    continue;
                }
                validProviders.push(provider);
            }
            providersToNotify = validProviders;
            console.log(`Providers Eligible After Debt Check: ${providersToNotify.length}`);

            const io = require('../config/socket').getIO();
            for (const provider of providersToNotify) {
                console.log(`Sending notification to Provider ID: ${provider._id}`);
                // Socket notification
                io.to(`provider_${provider._id}`).emit('NEW_BOOKING_REQUEST', {
                    bookingId: booking._id,
                    serviceName: booking.serviceName,
                    amount: booking.totalAmount,
                    discountAmount: booking.discountAmount || 0,
                    address: booking.address,
                    userName: req.user.name,
                    paymentMode: booking.paymentMode,
                    bookingDate: booking.bookingDate,
                    bookingTime: booking.bookingTime,
                    expiresAt: new Date(Date.now() + 2 * 60 * 1000),
                    bargainDiscount: booking.bargainDiscount,
                    customerOffer: booking.customerOffer,
                    originalFixedPrice: booking.originalFixedPrice,
                    offerStatus: booking.offerStatus
                });

                // Use unified notifyUser for persistence, socket, and push
                try {
                    const { notifyUser } = require('../config/notificationService');
                    await notifyUser({
                        userId: provider._id,
                        userRole: 'provider',
                        title: 'Urgent: Service Request!',
                        message: `You received a new request for ${booking.serviceName}. Accept now!`,
                        type: 'booking',
                        bookingId: booking._id,
                        data: {
                            link: `/provider/bookings`
                        }
                    });
                } catch (err) {
                    console.log('Notification persistence failed (skipping):', err.message);
                }
            }

            console.log('--- END DEBUG ---');

            // Notify user (booking confirmation)
            try {
                const { notifyUser } = require('../config/notificationService');
                await notifyUser({
                    userId: booking.userId,
                    userRole: 'user',
                    title: 'Booking Confirmed! ✓',
                    message: `Your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been placed.`,
                    type: 'booking',
                    bookingId: booking._id
                });
            } catch (err) {
                console.log('User booking confirmation notification failed (skipping):', err.message);
            }

            res.status(201).json({
                booking,
                notifiedCount: providersToNotify.length
            });
        } else {
            res.status(400).json({ message: 'Invalid booking data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user bookings
// @route   GET /api/bookings
// @access  Private
const getUserBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user._id })
            .populate('providerId', 'shopName ownerName rating reviewCount mobile profileImage status planType')
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update booking status (cancel/reschedule)
// @route   PUT /api/bookings/:id
// @access  Private
const updateBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (booking && booking.userId.toString() === req.user._id.toString()) {
            if (req.body.counterDecision) {
                const counterDecision = req.body.counterDecision; // 'accept' or 'reject'
                if (!['accept', 'reject'].includes(counterDecision)) {
                    return res.status(400).json({ message: 'Invalid counterDecision. Must be accept or reject.' });
                }

                // Check Expiration first
                const isExpired = (booking.counterOfferExpiresAt && new Date() > booking.counterOfferExpiresAt) ||
                    booking.offerStatus === 'counter_expired' ||
                    booking.offerStatus === 'counter_rejected' ||
                    booking.offerStatus === 'counter_accepted';

                if (isExpired) {
                    if (booking.offerStatus !== 'counter_expired' || booking.status !== 'cancelled') {
                        booking.offerStatus = 'counter_expired';
                        booking.status = 'cancelled';
                        await booking.save();
                    }
                    return res.status(410).json({ message: 'This counter-offer has expired.' });
                }

                // Check Provider Availability
                if (!booking.providerId) {
                    return res.status(400).json({ message: 'No provider is associated with this counter-offer.' });
                }

                const provider = await Provider.findById(booking.providerId);

                if (!provider || provider.isOnline === false || provider.status !== 'verified') {
                    booking.offerStatus = 'counter_expired';
                    booking.status = 'cancelled';
                    booking.providerId = null; // clear locks/providerId
                    await booking.save();

                    // Notify customer
                    try {
                        const { notifyUser } = require('../config/notificationService');
                        await notifyUser({
                            userId: booking.userId,
                            userRole: 'user',
                            title: 'Provider Unavailable',
                            message: 'The counter-offer is no longer available as the provider is unavailable.',
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } catch (err) {
                        console.log('Customer notification failed:', err.message);
                    }
                    return res.status(400).json({ message: 'The provider is no longer available.' });
                }

                // Perform atomic update using findOneAndUpdate
                const updateFields = {};
                if (counterDecision === 'accept') {
                    const nightCharge = booking.extraCharges && booking.extraCharges.find(c => c.item && c.item.startsWith('Night Charge'));
                    const oldAmount = nightCharge ? (nightCharge.amount || 0) : 0;
                    const ratio = oldAmount && booking.customerOffer ? (oldAmount / booking.customerOffer) : 0;
                    const newNightChargeAmount = Math.round(ratio * booking.partnerCounterOffer);
                    const newExtraCharges = booking.extraCharges.map(charge => {
                        if (charge.item && charge.item.startsWith('Night Charge')) {
                            return { item: charge.item, amount: newNightChargeAmount };
                        }
                        return charge;
                    });
                    const newTotalAmount = booking.partnerCounterOffer + newNightChargeAmount;
                    const bargainDiscount = booking.originalFixedPrice - newTotalAmount;
                    const totalDiscount = booking.couponDiscount + bargainDiscount;

                    updateFields.totalAmount = newTotalAmount;
                    updateFields.bargainDiscount = bargainDiscount;
                    updateFields.totalDiscount = totalDiscount;
                    updateFields.acceptedPrice = newTotalAmount;
                    updateFields.pricingDecision = 'partner_counter_offer';
                    updateFields.status = 'confirmed';
                    updateFields.offerStatus = 'counter_accepted';
                    updateFields.extraCharges = newExtraCharges;
                } else {
                    updateFields.status = 'cancelled';
                    updateFields.offerStatus = 'counter_rejected';
                }

                const updatedBooking = await Booking.findOneAndUpdate(
                    {
                        _id: booking._id,
                        status: 'pending',
                        offerStatus: 'countered',
                        counterOfferExpiresAt: { $gt: new Date() }
                    },
                    { $set: updateFields },
                    { new: true }
                );

                if (!updatedBooking) {
                    return res.status(409).json({ message: 'This counter-offer has already been processed or is no longer valid.' });
                }

                // Send socket notifications to the provider and user
                const io = require('../config/socket').getIO();
                io.to(`provider_${booking.providerId}`).emit('COUNTER_DECISION', {
                    bookingId: booking._id.toString(),
                    decision: counterDecision,
                    status: updatedBooking.status,
                    offerStatus: updatedBooking.offerStatus
                });
                io.emit('NEW_BOOKING_REQUEST'); // broadcast change to refresh provider list

                // Send push/in-app notifications
                try {
                    const { notifyUser } = require('../config/notificationService');
                    if (counterDecision === 'accept') {
                        await notifyUser({
                            userId: booking.providerId,
                            userRole: 'provider',
                            title: 'Counter-Offer Accepted!',
                            message: `Customer accepted your counter-offer of ₹${updatedBooking.totalAmount} for ${booking.serviceName}.`,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } else {
                        await notifyUser({
                            userId: booking.providerId,
                            userRole: 'provider',
                            title: 'Counter-Offer Rejected',
                            message: `Customer has rejected your counter-offer of ₹${booking.partnerCounterOffer} for ${booking.serviceName}.`,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    }
                } catch (err) {
                    console.log('Provider counter decision notification failed:', err.message);
                }

                return res.json(updatedBooking);
            }

            const { status, bookingDate, bookingTime } = req.body;

            booking.status = status || booking.status;
            booking.bookingDate = bookingDate || booking.bookingDate;
            booking.bookingTime = bookingTime || booking.bookingTime;

            const updatedBooking = await booking.save();

            // Notify if cancelled
            if (status === 'cancelled') {
                const { notifyUser } = require('../config/notificationService');
                // Notify provider if assigned
                if (booking.providerId) {
                    try {
                        await notifyUser({
                            userId: booking.providerId,
                            userRole: 'provider',
                            title: 'Booking Cancelled',
                            message: `User has cancelled booking #${booking._id.toString().slice(-6)} for ${booking.serviceName}.`,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } catch (err) {
                        console.log('Provider cancel notification failed (skipping):', err.message);
                    }
                }
                // Notify user (booking cancellation confirmation)
                try {
                    await notifyUser({
                        userId: booking.userId,
                        userRole: 'user',
                        title: 'Booking Cancelled',
                        message: `Your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been cancelled.`,
                        type: 'booking',
                        bookingId: booking._id
                    });
                } catch (err) {
                    console.log('User cancel notification failed (skipping):', err.message);
                }
            }

            res.json(updatedBooking);
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @route   GET /api/bookings/provider
// @access  Private (Provider)
const getProviderBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ providerId: req.user._id })
            .populate('userId', 'ownerName name mobile address') // Populate user details
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update booking status by provider (Accept/Started/Completed)
// @route   PATCH /api/bookings/:id/status
// @access  Private (Provider)
const updateBookingStatusByProvider = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (booking) {
            // Lock the booking to one provider during negotiation
            if (req.user.role === 'provider' && booking.providerId && booking.providerId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'This booking is locked by another provider.' });
            }

            const isAccepting = req.body.status === 'confirmed' || req.body.offerDecision === 'counter';

            const isAuthorized = (isAccepting && !booking.providerId) ||
                (booking.providerId && booking.providerId.toString() === req.user._id.toString()) ||
                (booking.userId && booking.userId.toString() === req.user._id.toString());
            if (!isAuthorized) {
                return res.status(401).json({ message: 'Not authorized for this booking' });
            }

            const newStatus = req.body.offerDecision === 'counter' ? 'pending' : (req.body.status || booking.status);

            // Assign provider if accepting
            if (isAccepting && !booking.providerId) {
                // Pre-check for race condition
                if (booking.status !== 'pending' || booking.offerStatus !== 'pending') {
                    return res.status(409).json({ message: 'This booking request is no longer pending or has already been processed.' });
                }

                // Check overlap first
                const overlap = await hasOverlap(req.user._id, booking.bookingDate, booking.bookingTime);
                if (overlap) {
                    return res.status(400).json({ message: 'You cannot accept this booking as it overlaps with an existing schedule (Blocked from 30 mins before to 20 mins after).' });
                }

                // Check if provider has excessive dues based on dynamic cash limits
                const { Wallet } = require('../models/Wallet');
                const Setting = require('../models/Setting');
                const Provider = require('../models/Provider');

                const [wallet, configSetting, provider] = await Promise.all([
                    Wallet.findOne({ providerId: req.user._id }),
                    Setting.findOne({ key: 'cash_limits_config' }),
                    Provider.findById(req.user._id)
                ]);

                let limit = 1500; // default global fallback
                if (configSetting && configSetting.value) {
                    const cfg = configSetting.value;
                    limit = Number(cfg.defaultLimit) || 1500;

                    if (provider && provider.vendorType) {
                        const catId = provider.vendorType.toString();
                        const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
                        if (catLimitObj) limit = Number(catLimitObj.limit);
                    }

                    const bookingServiceId = booking.serviceId ? booking.serviceId.toString() : (booking.services && booking.services.length > 0 ? booking.services[0].serviceId?.toString() : null);

                    if (bookingServiceId) {
                        const srvLimitObj = cfg.serviceLimits?.find(s => s.serviceId === bookingServiceId);
                        if (srvLimitObj) limit = Number(srvLimitObj.limit);
                    }
                }

                if (wallet && wallet.balance <= -limit) {
                    return res.status(403).json({ message: `Please settle your wallet dues to accept new bookings.` });
                }

                // Process custom offer decisions
                if (booking.customerOffer !== null) {
                    if (req.body.offerDecision === 'fixed_price') {
                        const nightCharge = booking.extraCharges && booking.extraCharges.find(c => c.item && c.item.startsWith('Night Charge'));
                        const oldAmount = nightCharge ? (nightCharge.amount || 0) : 0;
                        const ratio = oldAmount && booking.customerOffer ? (oldAmount / booking.customerOffer) : 0;
                        const newExtraCharges = booking.extraCharges.map(charge => {
                            if (charge.item && charge.item.startsWith('Night Charge')) {
                                const newAmount = Math.round(booking.originalFixedPrice - (booking.originalFixedPrice / (1 + ratio)));
                                return { item: charge.item, amount: newAmount };
                            }
                            return charge;
                        });
                        booking.totalAmount = booking.originalFixedPrice;
                        booking.bargainDiscount = 0;
                        booking.totalDiscount = booking.couponDiscount;
                        booking.offerStatus = 'rejected_fixed_price';
                        booking.pricingDecision = 'fixed_price';
                        booking.extraCharges = newExtraCharges;
                    } else if (req.body.offerDecision === 'counter') {
                        const counterAmount = Number(req.body.counterAmount);
                        if (!counterAmount || isNaN(counterAmount) || counterAmount <= 0) {
                            return res.status(400).json({ message: 'Counter offer must be a valid positive number.' });
                        }
                        if (counterAmount <= booking.customerOffer) {
                            return res.status(400).json({ message: `Counter offer must be greater than customer's offer of ₹${booking.customerOffer}.` });
                        }
                        if (counterAmount > booking.originalFixedPrice) {
                            return res.status(400).json({ message: `Counter offer cannot exceed original fixed price of ₹${booking.originalFixedPrice}.` });
                        }
                        booking.partnerCounterOffer = counterAmount;
                        booking.offerStatus = 'countered';
                        booking.counterOfferExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
                    } else {
                        booking.offerStatus = 'accepted';
                        booking.pricingDecision = 'customer_offer';
                    }
                } else {
                    booking.offerStatus = 'accepted';
                    booking.pricingDecision = 'fixed_price';
                }

                // Atomically claim the booking to prevent race conditions
                const claimedBooking = await Booking.findOneAndUpdate(
                    { _id: booking._id, status: 'pending', offerStatus: 'pending' },
                    {
                        $set: {
                            providerId: req.user._id,
                            status: booking.offerStatus === 'countered' ? 'pending' : 'confirmed',
                            offerStatus: booking.offerStatus,
                            totalAmount: booking.totalAmount,
                            bargainDiscount: booking.bargainDiscount,
                            totalDiscount: booking.totalDiscount,
                            extraCharges: booking.extraCharges,
                            partnerCounterOffer: booking.partnerCounterOffer,
                            counterOfferExpiresAt: booking.counterOfferExpiresAt,
                            pricingDecision: booking.pricingDecision
                        }
                    },
                    { new: true }
                );

                if (!claimedBooking) {
                    return res.status(409).json({ message: 'This booking has already been accepted by another provider.' });
                }

                booking.providerId = req.user._id;
                booking.acceptedAt = Date.now();
                booking.status = booking.offerStatus === 'countered' ? 'pending' : 'confirmed';
            }

            if (req.body.paymentStatus) {
                booking.paymentStatus = req.body.paymentStatus;

                // Cash Payment Settlement: When provider confirms cash collected
                // Credit providerPayout to Available Balance
                if (req.body.paymentStatus === 'paid' && booking.paymentMode === 'after' && booking.providerPayout > 0) {
                    try {
                        const { Wallet, Transaction } = require('../models/Wallet');
                        let wallet = await Wallet.findOne({ providerId: booking.providerId });
                        if (!wallet) {
                            wallet = await Wallet.create({ providerId: booking.providerId, balance: 0 });
                        }

                        // Credit provider's share to Available Balance
                        wallet.availableBalance += booking.providerPayout;
                        wallet.updatedAt = Date.now();
                        await wallet.save();

                        await Transaction.create({
                            providerId: booking.providerId,
                            title: `Cash Collected: ${booking.serviceName}`,
                            amount: booking.providerPayout,
                            type: 'credit',
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Cash payment collected from customer. Commission (₹${booking.adminCommission || 0}) already deducted separately.`
                        });

                        console.log(`[Cash Settlement] Provider ${booking.providerId} credited ₹${booking.providerPayout} for booking ${booking._id}`);
                    } catch (walletErr) {
                        console.error('[Cash Settlement] Wallet update failed:', walletErr.message);
                        // Don't block the booking update
                    }
                }
            }

            if (req.body.extraStatus) {
                booking.extraStatus = req.body.extraStatus;
            }
            if (req.body.extraCharges) {
                booking.extraCharges = req.body.extraCharges;
            }
            if (req.body.beforeImage) {
                booking.beforeImage = req.body.beforeImage;
            }
            if (req.body.adminRequest) {
                booking.adminRequest = {
                    status: 'pending',
                    reason: req.body.adminRequest.reason,
                    requestedAt: new Date()
                };
            }
            if (req.body.staffId) {
                booking.staffId = req.body.staffId;

                // Push Notification for Sewak (Staff)
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');
                    await sendNotificationToUser(req.body.staffId, 'provider', {
                        title: 'New Task Assigned',
                        body: 'Partner assigned you a new task.',
                        data: {
                            type: 'task',
                            id: booking._id.toString(),
                            link: '/provider/tasks'
                        }
                    });
                } catch (err) {
                    console.log('Push notification failed (skipping):', err.message);
                }
            }

            // Generate OTP if status is changed to 'on_the_way'
            if (newStatus === 'on_the_way' && !booking.startOTP) {
                const otp = Math.floor(1000 + Math.random() * 9000).toString();
                booking.startOTP = otp;

                // Notify User with OTP via unified service
                const { notifyUser } = require('../config/notificationService');
                await notifyUser({
                    userId: booking.userId,
                    userRole: 'user',
                    title: 'Start OTP Generated',
                    message: `Your OTP to START the service is: ${otp}. Please share it with the provider.`,
                    type: 'system',
                    bookingId: booking._id
                });
            }

            // Generate End OTP if Provider tries to complete but needs verification
            if (newStatus === 'completed' && booking.status === 'started' && !booking.endOTP) {
                const otp = Math.floor(1000 + Math.random() * 9000).toString();
                booking.endOTP = otp;
                if (req.body.afterImage) {
                    booking.afterImage = req.body.afterImage;
                }
                await booking.save();

                // Notify User with Completion OTP via unified service
                const { notifyUser } = require('../config/notificationService');
                await notifyUser({
                    userId: booking.userId,
                    userRole: 'user',
                    title: 'Completion OTP Generated',
                    message: `Your OTP to COMPLETE the service is: ${otp}. Please share it with the provider.`,
                    type: 'system',
                    bookingId: booking._id
                });

                return res.json({
                    message: 'Completion OTP generated and sent to customer.',
                    status: 'started' // Keep as started until verified
                });
            }

            if (newStatus === 'on_the_way' && booking.status !== 'on_the_way') {
                booking.onTheWayAt = Date.now();
            }
            booking.status = newStatus;
            const updatedBooking = await booking.save();

            // If cancelled by provider, notify Admin and deduct penalty
            if (newStatus === 'cancelled') {
                try {
                    const Setting = require('../models/Setting');
                    let config;
                    try {
                        const configData = await Setting.findOne({ key: 'partner_program_config' });
                        if (configData) config = JSON.parse(configData.value);
                    } catch (err) { }
                    const penalty = config?.penalties?.cancellationCharge ?? 50;

                    if (penalty > 0) {
                        const { Wallet, Transaction } = require('../models/Wallet');
                        let wallet = await Wallet.findOne({ providerId: req.user._id });
                        if (!wallet) {
                            wallet = await Wallet.create({ providerId: req.user._id, balance: 0 });
                        }
                        wallet.balance -= penalty;
                        await wallet.save();

                        await Transaction.create({
                            providerId: req.user._id,
                            title: 'Cancellation Penalty',
                            amount: penalty,
                            type: 'debit',
                            status: 'completed',
                            bookingId: booking._id,
                            description: 'Penalty for cancelling a booking'
                        });
                    }

                    const User = require('../models/User');
                    const { sendNotificationToUser } = require('../config/notificationService');

                    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });

                    for (const admin of admins) {
                        await sendNotificationToUser(admin._id, 'admin', {
                            title: 'Booking Cancelled by Provider',
                            body: `Provider ${req.user.ownerName} cancelled booking #${booking._id.toString().slice(-6)}.`,
                            data: {
                                type: 'booking',
                                id: booking._id.toString(),
                                link: '/admin/bookings'
                            }
                        });
                    }
                } catch (err) {
                    console.log('Cancellation penalty failed:', err.message);
                }
            }

            // If confirmed or countered, notify other potential providers to stop their alarms
            if (newStatus === 'confirmed' || booking.offerStatus === 'countered') {
                const io = require('../config/socket').getIO();
                io.emit('BOOKING_TAKEN', { bookingId: booking._id.toString() });

                if (booking.offerStatus === 'countered') {
                    io.to(`user_${booking.userId}`).emit('COUNTER_OFFER_RECEIVED', {
                        bookingId: booking._id.toString(),
                        partnerCounterOffer: booking.partnerCounterOffer,
                        counterOfferExpiresAt: booking.counterOfferExpiresAt
                    });

                    // Notify user
                    try {
                        const { notifyUser } = require('../config/notificationService');
                        await notifyUser({
                            userId: booking.userId,
                            userRole: 'user',
                            title: 'New Counter-Offer Proposed!',
                            message: `A partner has proposed a counter-offer of ₹${booking.partnerCounterOffer} for your request.`,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } catch (err) {
                        console.log('User counter-offer notification failed:', err.message);
                    }
                } else {
                    // Notify user that booking was accepted
                    try {
                        const { notifyUser } = require('../config/notificationService');
                        const isOfferAccepted = booking.offerStatus === 'accepted';
                        const message = isOfferAccepted
                            ? `A partner has accepted your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} at ₹${booking.totalAmount}.`
                            : `A partner has accepted your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} at the fixed price of ₹${booking.totalAmount}.`;

                        await notifyUser({
                            userId: booking.userId,
                            userRole: 'user',
                            title: isOfferAccepted ? 'Booking Accepted!' : 'Booking Accepted at Fixed Price!',
                            message: message,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } catch (err) {
                        console.log('User booking acceptance notification failed:', err.message);
                    }
                }
            }

            res.json(updatedBooking);
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP and start booking
// @route   POST /api/bookings/:id/start
// @access  Private (Provider)
const verifyStartOTP = async (req, res) => {
    const { otp, beforeImage } = req.body;
    try {
        const booking = await Booking.findById(req.params.id);

        if (booking) {
            // Allow both User and Provider to verify
            const isAuthorized =
                booking.providerId.toString() === req.user._id.toString() ||
                booking.userId.toString() === req.user._id.toString();

            if (!isAuthorized) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            // Payment check for Online Payments (Commented out for testing)
            // if (booking.paymentMode === 'now' && booking.paymentStatus !== 'paid') {
            //     return res.status(400).json({ message: 'Customer has not paid yet. Please ask them to pay from their app.' });
            // }

            if (booking.startOTP === otp) {
                booking.status = 'started';
                booking.startedAt = Date.now();
                booking.beforeImage = beforeImage;
                await booking.save();
                res.json({ message: 'Service started successfully', status: 'started' });
            } else {
                res.status(400).json({ message: 'Invalid OTP' });
            }
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify End OTP and complete booking
// @route   POST /api/bookings/:id/complete
// @access  Private (Provider)
const verifyEndOTP = async (req, res) => {
    const { otp, afterImage } = req.body;
    try {
        const booking = await Booking.findById(req.params.id);
        if (booking) {
            const isAuthorized = booking.providerId.toString() === req.user._id.toString() ||
                booking.userId.toString() === req.user._id.toString();
            if (!isAuthorized) return res.status(401).json({ message: 'Not authorized' });

            if (booking.endOTP === otp) {
                // Update Provider stats and Commission logic
                const provider = await Provider.findById(booking.providerId).populate('vendorType');

                let adminCommission = 0;
                let providerPayout = booking.totalAmount;
                let commissionStatus = 'free';

                // Fetch Partner Program Config
                const Setting = require('../models/Setting');
                let config;
                try {
                    const configData = await Setting.findOne({ key: 'partner_program_config' });
                    if (configData) {
                        config = JSON.parse(configData.value);
                    }
                } catch (err) {
                    console.log('Error fetching partner config, using defaults');
                }

                // Default Fallbacks
                config = config || {
                    commissionSlabs: [
                        { min: 50, max: 100, rate: 15 },
                        { min: 101, max: 300, rate: 14 },
                        { min: 301, max: 700, rate: 12 },
                        { min: 701, max: 999999, rate: 10 }
                    ],
                    subscriptionPlans: { elite: { commissionRate: 0 }, pro: { commissionRate: 5 }, basic: { commissionRate: 8 } },
                    performanceBonuses: { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
                    penalties: { cancellationCharge: 50 },
                    referral: { commissionRate: 1, durationMonths: 12 },
                    attendance: { requiredDays: 30, discountRate: 2 }
                };

                if (provider.providerCategory === 'sewak') {
                    adminCommission = booking.totalAmount;
                    providerPayout = 0;
                    commissionStatus = 'sewak_revenue';
                } else if (provider.freeServicesLeft > 0) {
                    provider.freeServicesLeft -= 1;
                    adminCommission = 0;
                    providerPayout = booking.totalAmount;
                    commissionStatus = 'free_new_joiner';
                } else {
                    let rate = 10;
                    let commissionAmount = 0;

                    if (provider.isSubscribed && provider.subscriptionRate !== null) {
                        if (provider.subscriptionType === 'fixed') {
                            commissionAmount = provider.subscriptionRate;
                        } else {
                            rate = provider.subscriptionRate;
                            commissionAmount = (booking.totalAmount * rate) / 100;
                        }
                        commissionStatus = `subscription_active`;
                    } else {
                        // Amount Slabs by Category
                        const amt = booking.totalAmount;
                        const providerCategoryId = provider.vendorType?._id?.toString() || provider.vendorType?.toString();

                        let matchingSlabs = config.commissionSlabs?.filter(s => s.categoryId === providerCategoryId) || [];
                        if (matchingSlabs.length === 0) {
                            matchingSlabs = config.commissionSlabs?.filter(s => !s.categoryId || s.categoryId === 'default' || s.categoryId === '') || [];
                        }

                        const slab = matchingSlabs.find(s => amt >= s.min && amt <= s.max);
                        rate = slab ? slab.rate : (matchingSlabs.length > 0 ? matchingSlabs[0].rate : 10);
                        commissionAmount = (booking.totalAmount * rate) / 100;
                        commissionStatus = 'slab_commission';
                    }

                    // Attendance Bonus Discount (Only applies if percentage based)
                    if (provider.attendanceBonusActive && (!provider.isSubscribed || provider.subscriptionType !== 'fixed')) {
                        const discount = (booking.totalAmount * (config.attendance?.discountRate || 0)) / 100;
                        commissionAmount = Math.max(0, commissionAmount - discount);
                    }

                    adminCommission = commissionAmount;
                    providerPayout = booking.totalAmount - adminCommission;
                }

                // --- Partner Program Bonuses ---
                if (provider.providerCategory !== 'sewak') {
                    provider.bookingsCount = (provider.bookingsCount || 0) + 1;

                    // Loyalty Bonus
                    if (provider.bookingsCount === config.performanceBonuses.loyaltyBonusBookings) {
                        providerPayout += config.performanceBonuses.loyaltyBonusAmount;
                        const { Transaction } = require('../models/Wallet');
                        await Transaction.create({
                            providerId: provider._id,
                            title: 'Loyalty Bonus',
                            amount: config.performanceBonuses.loyaltyBonusAmount,
                            type: 'credit',
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Completed ${config.performanceBonuses.loyaltyBonusBookings} Bookings`
                        });
                    }

                    // Star Bonus
                    let starBonusPercent = 0;
                    if (provider.badges?.includes('GoldStar')) starBonusPercent = config.performanceBonuses.goldStarRate;
                    else if (provider.badges?.includes('SilverStar')) starBonusPercent = config.performanceBonuses.silverStarRate;

                    if (starBonusPercent > 0) {
                        const starBonus = (booking.totalAmount * starBonusPercent) / 100;
                        providerPayout += starBonus;
                        const { Transaction } = require('../models/Wallet');
                        await Transaction.create({
                            providerId: provider._id,
                            title: 'Star Bonus',
                            amount: starBonus,
                            type: 'credit',
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Performance Bonus (${starBonusPercent}%)`
                        });
                    }

                    // Referral Commission
                    if (provider.referredBy) {
                        const durationAgo = new Date();
                        durationAgo.setMonth(durationAgo.getMonth() - config.referral.durationMonths);
                        if (provider.joinedDate > durationAgo) {
                            const refComm = (booking.totalAmount * config.referral.commissionRate) / 100;

                            // Admin pays for referral commission
                            adminCommission = Math.max(0, adminCommission - refComm);

                            const { Wallet, Transaction } = require('../models/Wallet');
                            let refWallet = await Wallet.findOne({ providerId: provider.referredBy });
                            if (refWallet) {
                                refWallet.balance += refComm;
                                await refWallet.save();
                                await Transaction.create({
                                    providerId: provider.referredBy,
                                    title: 'Referral Commission',
                                    amount: refComm,
                                    type: 'credit',
                                    status: 'completed',
                                    bookingId: booking._id,
                                    description: `${config.referral.commissionRate}% commission from referred provider`
                                });
                            }
                        }
                    }
                }

                // Update booking with commission details
                booking.status = 'completed';
                booking.completedAt = Date.now();
                if (afterImage) {
                    booking.afterImage = afterImage;
                }
                booking.adminCommission = adminCommission;
                booking.providerPayout = providerPayout;
                booking.commissionStatus = commissionStatus;

                // Update provider wallet and record transaction
                const { Wallet, Transaction } = require('../models/Wallet');
                let wallet = await Wallet.findOne({ providerId: provider._id });
                if (!wallet) {
                    wallet = await Wallet.create({ providerId: provider._id, balance: 0 });
                }
                // Cash Collection Logic (Provider keeps full amount, owes admin commission)
                let transactionAmount = 0;
                let transactionType = 'credit';
                let transactionTitle = '';

                if (booking.paymentMode !== 'now') {
                    // Provider collected cash, deduct commission from balance (dues)
                    wallet.balance -= adminCommission;
                    transactionAmount = adminCommission;
                    transactionType = 'debit';
                    transactionTitle = `Commission Deducted: ${booking.serviceName}`;
                } else {
                    // Online payment to admin, credit provider payout to availableBalance (withdrawable)
                    wallet.availableBalance += providerPayout;
                    transactionAmount = providerPayout;
                    transactionType = 'credit';
                    transactionTitle = `Service Earnings: ${booking.serviceName}`;
                }

                wallet.updatedAt = Date.now();
                await wallet.save();

                const transaction = await Transaction.create({
                    providerId: provider._id,
                    title: transactionTitle,
                    amount: transactionAmount,
                    type: transactionType,
                    status: 'completed',
                    bookingId: booking._id,
                    description: `Booking ID #${booking._id.toString().slice(-6)}`
                });

                provider.walletBalance = wallet.balance;
                await provider.save();

                // Decoupled Booking Completed Notifications
                try {
                    const { notifyUser } = require('../config/notificationService');
                    
                    // Notify Provider
                    await notifyUser({
                        userId: booking.providerId,
                        userRole: 'provider',
                        title: 'Booking Completed ✓',
                        message: `Your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been successfully completed.`,
                        type: 'booking',
                        bookingId: booking._id
                    });

                    // Notify Customer
                    await notifyUser({
                        userId: booking.userId,
                        userRole: 'user',
                        title: 'Booking Completed ✓',
                        message: `Your service #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been completed.`,
                        type: 'booking',
                        bookingId: booking._id
                    });
                } catch (notiErr) {
                    console.error('[Notification Trigger Error] Failed to send booking completion notification:', notiErr);
                }

                // Push Notification for Provider
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');

                    // 1. Wallet Update Notification
                    if (transactionAmount > 0) {
                        const actionWord = transactionType === 'credit' ? 'credited to' : 'deducted from';
                        await sendNotificationToUser(booking.providerId, 'provider', {
                            title: `Wallet ${transactionType === 'credit' ? 'Credited' : 'Deducted'}`,
                            body: `₹${transactionAmount} ${actionWord} your wallet for booking #${booking._id.toString().slice(-6)}.`,
                            data: {
                                type: 'wallet',
                                id: booking._id.toString(),
                                link: '/provider/wallet'
                            }
                        });
                    }

                    // 2. Sewak Completed Task (Notify Partner if staff was assigned)
                    if (booking.staffId) {
                        await sendNotificationToUser(booking.providerId, 'provider', {
                            title: 'Task Completed by Sewak',
                            body: `Your assigned task #${booking._id.toString().slice(-6)} has been completed.`,
                            data: {
                                type: 'booking',
                                id: booking._id.toString(),
                                link: '/provider/bookings'
                            }
                        });
                    }
                } catch (err) {
                    console.log('Push notification failed (skipping):', err.message);
                }

                // --- Sewak Daily Incentive Logic ---
                if (provider.providerCategory === 'sewak') {
                    try {
                        const today = new Date().toISOString().split('T')[0];

                        // Fetch global incentive settings
                        const settings = await Setting.find({ key: { $in: ['DAILY_BOOKING_THRESHOLD', 'BONUS_PER_EXTRA_BOOKING'] } });
                        const threshold = Number(settings.find(s => s.key === 'DAILY_BOOKING_THRESHOLD')?.value || 5);
                        const bonusAmount = Number(settings.find(s => s.key === 'BONUS_PER_EXTRA_BOOKING')?.value || 50);

                        // Count bookings completed by this sewak today
                        const startOfDay = new Date();
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date();
                        endOfDay.setHours(23, 59, 59, 999);

                        const dailyCount = await Booking.countDocuments({
                            providerId: provider._id,
                            status: 'completed',
                            updatedAt: { $gte: startOfDay, $lte: endOfDay }
                        });

                        if (dailyCount > threshold) {
                            // Apply bonus
                            await SewakIncentiveLog.create({
                                sewakId: provider._id,
                                bookingId: booking._id,
                                date: today,
                                dailyBookingCount: dailyCount,
                                bonusEarned: bonusAmount
                            });

                            // Add bonus to wallet
                            wallet.balance += bonusAmount;
                            await Transaction.create({
                                providerId: provider._id,
                                title: `Daily Performance Bonus`,
                                amount: bonusAmount,
                                type: 'credit',
                                status: 'completed',
                                bookingId: booking._id,
                                description: `Incentive for completing ${dailyCount} bookings today (Threshold: ${threshold})`
                            });
                            provider.walletBalance = wallet.balance;
                        }
                    } catch (incError) {
                        console.error("Incentive Calculation Error:", incError);
                    }
                }

                await Promise.all([booking.save(), provider.save(), wallet.save()]);

                res.json({
                    message: 'Service completed successfully',
                    status: 'completed',
                    payout: providerPayout,
                    commission: adminCommission
                });
            } else {
                res.status(400).json({ message: 'Invalid OTP' });
            }
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        console.error("verifyEndOTP CRASH:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get provider reviews
const getProviderReviews = async (req, res) => {
    try {
        const bookings = await Booking.find({
            providerId: req.user._id,
            rating: { $gt: 0 }
        }).populate('userId', 'name profileImage');

        const reviews = bookings.map(b => ({
            _id: b._id,
            user: b.userId?.name || 'Customer',
            profileImage: b.userId?.profileImage,
            service: b.serviceName,
            rating: b.rating,
            review: b.comment,
            date: b.createdAt
        }));

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get public provider reviews
const getPublicProviderReviews = async (req, res) => {
    try {
        const bookings = await Booking.find({
            providerId: req.params.id,
            rating: { $gt: 0 }
        }).populate('userId', 'name profileImage');

        const reviews = bookings.map(b => ({
            _id: b._id,
            user: b.userId?.name || 'Customer',
            profileImage: b.userId?.profileImage,
            service: b.serviceName,
            rating: b.rating,
            review: b.comment,
            date: b.createdAt
        }));

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const submitReview = async (req, res) => {
    const { rating, comment, tags } = req.body;
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        booking.rating = rating;
        booking.comment = comment;
        booking.tags = tags || [];

        await booking.save();

        // Push Notification for Provider (New Review)
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(booking.providerId, 'provider', {
                title: 'New Review Received!',
                body: `A customer gave you a ${rating} star review!`,
                data: {
                    type: 'review',
                    id: booking._id.toString(),
                    link: '/provider/reviews'
                }
            });
        } catch (err) {
            console.log('Push notification failed (skipping):', err.message);
        }

        res.json({ message: 'Review submitted successfully', booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const proposeSchedule = async (req, res) => {
    try {
        const { date, time, message } = req.body;
        const providerId = req.user._id;

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ message: 'Can only propose schedule for pending bookings' });
        }

        // Check overlap for the proposed schedule
        const overlap = await hasOverlap(providerId, date, time);
        if (overlap) {
            return res.status(400).json({ message: 'You cannot propose this schedule as it overlaps with an existing schedule (Blocked from 30 mins before to 20 mins after).' });
        }

        booking.proposedSchedule = {
            providerId,
            date,
            time,
            message,
            status: 'pending'
        };

        await booking.save();

        // Notify User
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.to(`user_${booking.userId}`).emit('SCHEDULE_PROPOSED', { bookingId: booking._id, proposedSchedule: booking.proposedSchedule });

        res.json({ message: 'Schedule proposed successfully', booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const acceptSchedule = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking || !booking.proposedSchedule || booking.proposedSchedule.status !== 'pending') {
            return res.status(404).json({ message: 'Valid proposed schedule not found' });
        }

        // Must be the user
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Apply schedule
        const proposedDate = booking.proposedSchedule.date;
        const proposedTime = booking.proposedSchedule.time;
        const providerId = booking.proposedSchedule.providerId;

        // Check if provider got booked during the meantime
        const overlap = await hasOverlap(providerId, proposedDate, proposedTime);
        if (overlap) {
            return res.status(400).json({ message: 'The provider has accepted another booking during this time. Please request a different time.' });
        }

        booking.bookingDate = proposedDate;
        booking.bookingTime = proposedTime;
        booking.providerId = providerId;
        booking.status = 'confirmed';
        booking.proposedSchedule.status = 'accepted';

        await booking.save();

        // Notify Provider
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.to(`provider_${booking.providerId}`).emit('SCHEDULE_ACCEPTED', { bookingId: booking._id, booking });
        io.emit('NEW_BOOKING_REQUEST'); // broadcast change to refresh lists

        res.json({ message: 'Schedule accepted successfully', booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const rejectSchedule = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking || !booking.proposedSchedule || booking.proposedSchedule.status !== 'pending') {
            return res.status(404).json({ message: 'Valid proposed schedule not found' });
        }

        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const providerId = booking.proposedSchedule.providerId;
        booking.proposedSchedule.status = 'rejected';

        await booking.save();

        // Notify Provider
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.to(`provider_${providerId}`).emit('SCHEDULE_REJECTED', { bookingId: booking._id });

        res.json({ message: 'Schedule rejected successfully', booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const checkOverlapStatus = async (req, res) => {
    try {
        const { date, time } = req.query;
        if (!date || !time) {
            return res.status(400).json({ message: 'Date and time are required' });
        }
        const overlap = await hasOverlap(req.user._id, date, time);
        res.json({ overlap });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Counter offer a booking (Provider)
// @route   PATCH /api/bookings/:id/counter-offer
// @access  Private (Provider)
const counterOfferBooking = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: 'Valid amount is required' });

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.status !== 'pending') return res.status(400).json({ message: 'Booking is no longer pending' });

        if (!booking.providerId) {
            // Assign this provider temporarily for negotiation
            booking.providerId = req.user._id;
        } else if (booking.providerId.toString() !== req.user._id.toString()) {
            return res.status(400).json({ message: 'Another provider is currently negotiating this booking' });
        }

        booking.negotiation.providerCounterAmount = amount;
        booking.negotiation.status = 'provider_countered';

        await booking.save();
        await booking.populate('providerId', 'name mobile shopName location category');
        await booking.populate('userId', 'name mobile email');

        // Notify User
        const { emitToUser } = require('../config/socket');
        emitToUser(booking.userId._id, 'booking_update', booking);

        // Push notification
        await Notification.create({
            recipientId: booking.userId._id,
            recipientModel: 'User',
            title: 'Provider Counter-Offer',
            message: `A provider has proposed ₹${amount} for your request.`,
            type: 'booking_update',
            relatedId: booking._id
        });

        res.json(booking);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Accept provider's counter offer (User)
// @route   PATCH /api/bookings/:id/accept-counter
// @access  Private (User)
const acceptCounterOffer = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (booking.negotiation.status !== 'provider_countered') {
            return res.status(400).json({ message: 'No counter offer to accept' });
        }

        booking.totalAmount = booking.negotiation.providerCounterAmount;
        booking.negotiation.status = 'accepted';
        booking.status = 'confirmed'; // Booking is now confirmed

        await booking.save();
        await booking.populate('providerId', 'name mobile shopName location category');
        await booking.populate('userId', 'name mobile email');

        // Notify Provider
        const { emitToProvider } = require('../config/socket');
        emitToProvider(booking.providerId._id, 'booking_update', booking);

        await Notification.create({
            recipientId: booking.providerId._id,
            recipientModel: 'Provider',
            title: 'Offer Accepted!',
            message: `Customer accepted your counter-offer of ₹${booking.totalAmount}.`,
            type: 'booking_update',
            relatedId: booking._id
        });

        res.json(booking);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reject provider's counter offer (User)
// @route   PATCH /api/bookings/:id/reject-counter
// @access  Private (User)
const rejectCounterOffer = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (booking.negotiation.status !== 'provider_countered') {
            return res.status(400).json({ message: 'No counter offer to reject' });
        }

        const oldProvider = booking.providerId;

        // Send it back to broadcast pool
        booking.providerId = null;
        booking.negotiation.status = booking.negotiation.userProposedAmount ? 'user_proposed' : 'none';
        booking.negotiation.providerCounterAmount = null;

        await booking.save();

        // Notify rejected Provider
        const { emitToProvider, emitToRole } = require('../config/socket');
        emitToProvider(oldProvider, 'booking_update', { _id: booking._id, status: 'rejected_counter' });

        await Notification.create({
            recipientId: oldProvider,
            recipientModel: 'Provider',
            title: 'Offer Rejected',
            message: `Customer rejected your counter-offer for ${booking.serviceName}.`,
            type: 'booking_update',
            relatedId: booking._id
        });

        // Re-broadcast to all sewaks
        if (booking.requiredProviderCategory === 'sewak') {
            emitToRole('sewak', 'new_booking_request', booking);
        }

        res.json(booking);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    createBooking,
    getUserBookings,
    getProviderBookings,
    updateBooking,
    updateBookingStatusByProvider,
    verifyStartOTP,
    verifyEndOTP,
    getProviderReviews,
    getPublicProviderReviews,
    submitReview,
    proposeSchedule,
    acceptSchedule,
    rejectSchedule,
    checkOverlapStatus,
    counterOfferBooking,
    acceptCounterOffer,
    rejectCounterOffer,
};
