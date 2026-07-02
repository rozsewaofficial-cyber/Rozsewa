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
const DistanceChargeService = require('../services/DistanceChargeService');
const { sendEmail } = require('../utils/emailService');

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
        customerOffer,
        userProposedAmount,
        serviceLocation = 'home' } = req.body;

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
            couponCode,
            discountAmount: totalDiscount,
            customerOffer: customerOffer !== undefined && customerOffer !== null ? payableAmount : null,
            originalFixedPrice,
            bargainDiscount,
            couponDiscount,
            totalDiscount,
            paymentMode,
            serviceLocation,
            extraCharges: nightChargeAmount > 0 ? [{ item: `Night Charge (${appliedNightChargePercent}%)`, amount: nightChargeAmount }] : []
        });

        let booking = await newBooking.save();

        if (booking) {
            console.log(`Booking Created: ID=${booking._id}, User=${req.user._id}`);

            if (providerId) {
                if (serviceLocation === 'shop') {
                    booking.travelCharge = { amount: 0, status: 'final', calculationMethod: 'none', calculatedAt: new Date() };
                    await booking.save();
                } else {
                    // If specific provider is selected, calculate travel charge immediately
                    const travelChargeResult = await DistanceChargeService.applyTravelChargeToBooking(booking._id, providerId);
                    booking = travelChargeResult.booking;
                }
            } else {
                if (serviceLocation === 'shop') {
                    booking.travelCharge = { amount: 0, status: 'estimated', calculationMethod: 'none', calculatedAt: new Date() };
                    await booking.save();
                } else {
                    // For broadcast, just set a fallback estimation for now
                    const config = await DistanceChargeService.getConfig();
                    if (config.enabled) {
                        booking.travelCharge = {
                            amount: config.fallbackCharge || 40,
                            status: 'estimated',
                            calculationMethod: config.calculationMethod,
                            calculatedAt: new Date(),
                        };
                        await booking.save();
                    }
                }
            }

            // ─── Two-Stage Radius Dispatch ───────────────────────────────────────────────
            // Stage 1: Broad geo query using admin-configured maximumRadius as the net.
            // Stage 2: Per-provider haversine filter against each provider's own serviceRadius.
            // This is necessary because MongoDB $geoWithin cannot apply a different radius
            // per document inside a single query.

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
                }
            }

            if (providersToNotify.length === 0) {
                const targetCategory = requiredProviderCategory || 'partner';

                if (!booking.location || !booking.location.coordinates || booking.location.coordinates.length < 2) {
                    console.log(`FAILED: Booking has no valid coordinates. Dispatching to ALL online ${targetCategory}s as fallback...`);
                    providersToNotify = await Provider.find({ _id: { $ne: req.user._id }, status: 'verified', isOnline: true, providerCategory: targetCategory });
                } else {
                    // --- Load admin-configured radius limits (Stage 1 net width) ---
                    const radiusLimitSetting = await Setting.findOne({ key: 'provider_service_radius_limits' });
                    const radiusLimits = (radiusLimitSetting && radiusLimitSetting.value)
                        ? radiusLimitSetting.value
                        : { minimumRadius: 1, maximumRadius: 50 };

                    const broadRadiusKm = radiusLimits.maximumRadius; // Cast widest possible net
                    const broadRadiusRadians = broadRadiusKm / 6371;

                    // Stage 1: Pull candidate providers within the maximum possible radius
                    const providerQuery = {
                        _id: { $ne: req.user._id },
                        status: 'verified',
                        isOnline: true,
                        providerCategory: targetCategory,
                        location: {
                            $geoWithin: {
                                $centerSphere: [booking.location.coordinates, broadRadiusRadians]
                            }
                        }
                    };
                    if (serviceLocation === 'home') {
                        providerQuery.$or = [
                            { serviceModes: 'home' },
                            { serviceModes: { $exists: false } },
                            { serviceModes: { $size: 0 } }
                        ];
                    } else {
                        providerQuery.serviceModes = 'shop';
                    }
                    const candidateProviders = await Provider.find(providerQuery);

                    console.log(`Stage 1: ${candidateProviders.length} candidates found within ${broadRadiusKm} km broad net`);

                    // Stage 2: Filter each provider by their own configured serviceRadius using haversine
                    const bLon = booking.location.coordinates[0];
                    const bLat = booking.location.coordinates[1];

                    const filteredByRadius = candidateProviders.filter(p => {
                        const providerRadius = (typeof p.serviceRadius === 'number' && p.serviceRadius > 0)
                            ? p.serviceRadius
                            : 15; // Default for existing providers without serviceRadius set

                        if (!p.location || !p.location.coordinates || p.location.coordinates.length < 2) {
                            // No coordinates — include with a warning (fallback)
                            console.log(`Provider ${p._id} has no location, including as fallback`);
                            return true;
                        }

                        const pLon = p.location.coordinates[0];
                        const pLat = p.location.coordinates[1];
                        const distanceKm = DistanceChargeService.calculateDistance(bLat, bLon, pLat, pLon);
                        const withinRadius = distanceKm <= providerRadius;

                        console.log(`Provider ${p._id}: radius=${providerRadius}km, distance=${distanceKm?.toFixed(2)}km, eligible=${withinRadius}`);
                        return withinRadius;
                    });

                    console.log(`Stage 2: ${filteredByRadius.length} providers within their own serviceRadius`);
                    providersToNotify = filteredByRadius;
                }
            }


            console.log(`Providers Found: ${providersToNotify.length}`);

            // Filter out providers who have exceeded their cash limit
            const { Wallet } = require('../models/Wallet');
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
                const walletBalance = wallet ? wallet.balance : 0;
                if (walletBalance <= -limit) {
                    console.log(`[Debt Enforcement] Provider ${provider._id} blocked from receiving booking (Balance: ${walletBalance}, Limit: -${limit})`);
                    continue;
                }
                if (!wallet) {
                    console.log(`[Wallet Check] Provider ${provider._id} has no wallet yet (treated as ₹0 balance), allowed.`);
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
                    offerStatus: booking.offerStatus,
                    extraCharges: booking.extraCharges || [],
                    serviceLocation: booking.serviceLocation
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
                        bookingId: booking._id
                    });

                    // Send Email Notification
                    if (provider.email) {
                        const emailSubject = `New Service Request: ${booking.serviceName}`;
                        const emailHtml = `
                            <h2>New Service Request Received</h2>
                            <p>Hello ${provider.ownerName || 'Provider'},</p>
                            <p>You have received a new service request for <strong>${booking.serviceName}</strong>.</p>
                            <p><strong>Booking Date:</strong> ${new Date(booking.bookingDate).toLocaleDateString()}</p>
                            <p><strong>Booking Time:</strong> ${booking.bookingTime}</p>
                            <p><strong>Location:</strong> ${booking.address}</p>
                            <br>
                            <p>Please log in to your provider dashboard to accept the booking before it expires.</p>
                            <br>
                            <p>Thank you,<br>RozSewa Team</p>
                        `;
                        try {
                            await sendEmail(provider.email, emailSubject, emailHtml);
                        } catch (emailErr) {
                            console.log('Failed to send email to provider:', emailErr.message);
                        }
                    }
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
            .populate('providerId', 'shopName ownerName rating reviewCount mobile profileImage status planType address city state location')
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
        console.log(`[updateBooking] called with ID: ${req.params.id}`);
        console.log(`[updateBooking] req.user._id: ${req.user._id}`);

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            console.log(`[updateBooking] Booking not found in DB for ID: ${req.params.id}`);
        } else {
            console.log(`[updateBooking] Booking found. booking.userId: ${booking.userId}`);
        }

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

            if (status === 'cancelled' && booking.status !== 'pending') {
                return res.status(400).json({ message: 'Once an order is approved, it cannot be cancelled.' });
            }

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
            res.status(404).json({ message: `Booking not found or unauthorized to cancel. ID: ${req.params.id}` });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @route   GET /api/bookings/provider
// @access  Private (Provider)
const getProviderBookings = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: "Provider not found" });
        }

        // Fetch pending broadcast bookings eligible for this provider
        const pendingBookings = await Booking.find({
            status: 'pending',
            providerId: { $in: [null, undefined] },
            requiredProviderCategory: provider.providerCategory || 'partner',
            rejectedProviders: { $ne: provider._id },
            serviceLocation: { $in: provider.serviceModes && provider.serviceModes.length ? provider.serviceModes : ['home'] }
        }).populate('userId', 'ownerName name mobile address');

        // Fetch Wallet and Cash Limits
        const { Wallet } = require('../models/Wallet');
        const Setting = require('../models/Setting');
        const [wallet, configSetting] = await Promise.all([
            Wallet.findOne({ providerId: req.user._id }),
            Setting.findOne({ key: 'cash_limits_config' })
        ]);
        const walletBalance = wallet ? wallet.balance : 0;

        let defaultLimit = 1500;
        let catLimitOverride = null;
        let cfg = null;
        if (configSetting && configSetting.value) {
            cfg = configSetting.value;
            defaultLimit = Number(cfg.defaultLimit) || 1500;
            if (provider.vendorType) {
                const catId = provider.vendorType.toString();
                const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
                if (catLimitObj) catLimitOverride = Number(catLimitObj.limit);
            }
        }

        // Filter by provider service radius and debt limits
        const bLon = provider.location?.coordinates?.[0];
        const bLat = provider.location?.coordinates?.[1];
        const providerRadius = provider.serviceRadius || 15;

        const eligiblePending = pendingBookings.filter(b => {
            // Debt limit check per booking
            let bookingLimit = catLimitOverride !== null ? catLimitOverride : defaultLimit;
            const bookingServiceId = b.serviceId ? b.serviceId.toString() : (b.services && b.services.length > 0 ? b.services[0].serviceId?.toString() : null);
            if (bookingServiceId && cfg && cfg.serviceLimits) {
                const srvLimitObj = cfg.serviceLimits.find(s => s.serviceId === bookingServiceId);
                if (srvLimitObj) bookingLimit = Number(srvLimitObj.limit);
            }
            if (walletBalance <= -bookingLimit) return false;

            // Radius check
            if (!b.location || !b.location.coordinates || b.location.coordinates.length < 2) return true; // fallback
            if (!bLat || !bLon) return true; // fallback if provider location is not set
            const dist = DistanceChargeService.calculateDistance(b.location.coordinates[1], b.location.coordinates[0], bLat, bLon);
            return dist <= providerRadius;
        });

        // Fetch bookings assigned to this provider
        const assignedBookings = await Booking.find({ providerId: req.user._id })
            .populate('userId', 'ownerName name mobile address')
            .sort({ createdAt: -1 });

        // Combine and sort by createdAt descending
        const combined = [...eligiblePending, ...assignedBookings];
        combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(combined);
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
            // Intercept pending booking rejection to avoid cancelling the order
            if (req.body.status === 'cancelled' && booking.status === 'pending') {
                console.log(`[Monitoring] Booking rejection event (API): Provider ${req.user._id} rejected Booking ${booking._id}.`);

                if (!booking.rejectedProviders) {
                    booking.rejectedProviders = [];
                }
                if (!booking.rejectedProviders.includes(req.user._id)) {
                    booking.rejectedProviders.push(req.user._id);
                    await booking.save();
                }

                const io = require('../config/socket').getIO();
                io.emit('NEW_BOOKING_REQUEST');

                return res.json(booking);
            }

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

            if (newStatus === 'cancelled' && booking.status !== 'pending' && req.user.role !== 'provider') {
                return res.status(400).json({ message: 'Once an order is approved, it cannot be cancelled.' });
            }

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

                // Apply Distance Charge upon acceptance
                const travelChargeResult = await DistanceChargeService.applyTravelChargeToBooking(claimedBooking._id, req.user._id);
                // Assign updated fields from travelChargeResult.booking to the current booking object in memory
                // so subsequent saves in this controller don't overwrite it
                booking.travelCharge = travelChargeResult.booking.travelCharge;
                booking.extraCharges = travelChargeResult.booking.extraCharges;
                booking.totalAmount = travelChargeResult.booking.totalAmount;

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
                const previousExtraStatus = booking.extraStatus;
                booking.extraStatus = req.body.extraStatus;

                // If provider just added extra charges and status became pending
                if (req.body.extraStatus === 'pending' && previousExtraStatus !== 'pending') {
                    try {
                        const io = require('../config/socket').getIO();
                        io.to(`user_${booking.userId}`).emit('EXTRA_CHARGES_PENDING', {
                            bookingId: booking._id.toString(),
                            extraCharges: req.body.extraCharges
                        });

                        const { notifyUser } = require('../config/notificationService');
                        notifyUser({
                            userId: booking.userId,
                            userRole: 'user',
                            title: 'Extra Charges Added',
                            message: `Provider has added extra charges for spare parts. Please approve them.`,
                            type: 'booking',
                            bookingId: booking._id
                        }).catch(err => console.log('Extra charges notification failed:', err.message));
                    } catch (err) {
                        console.log('Extra charges socket/notification error:', err.message);
                    }
                }

                // If user approved or declined extra charges
                if (['approved', 'declined'].includes(req.body.extraStatus) && previousExtraStatus === 'pending') {
                    try {
                        const io = require('../config/socket').getIO();
                        io.to(`provider_${booking.providerId}`).emit('EXTRA_CHARGES_UPDATE', {
                            bookingId: booking._id.toString(),
                            extraStatus: req.body.extraStatus
                        });

                        const { notifyUser } = require('../config/notificationService');
                        notifyUser({
                            userId: booking.providerId,
                            userRole: 'provider',
                            title: 'Extra Charges ' + (req.body.extraStatus === 'approved' ? 'Approved' : 'Declined'),
                            message: `Customer has ${req.body.extraStatus} your extra charges.`,
                            type: 'booking',
                            bookingId: booking._id
                        }).catch(err => console.log('Extra charges update notification failed:', err.message));
                    } catch (err) {
                        console.log('Extra charges update socket/notification error:', err.message);
                    }
                }
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

            // If cancelled by provider, notify Admin, deduct penalty, credit user and admin
            if (newStatus === 'cancelled') {
                if (req.body.cancellationReason) {
                    booking.cancellationReason = req.body.cancellationReason;
                    booking.cancelledBy = req.user.role;
                }
                const updatedBookingWithReason = await booking.save();
                try {
                    const PartnerProgram = require('../models/PartnerProgram');
                    const partnerConfig = await PartnerProgram.findOne();
                    const penalty = (partnerConfig && partnerConfig.penalties && partnerConfig.penalties.cancellationCharge !== undefined)
                        ? partnerConfig.penalties.cancellationCharge
                        : 100;
                    const creditAmount = penalty / 2;

                    const { Wallet, Transaction } = require('../models/Wallet');
                    const Provider = require('../models/Provider');
                    const User = require('../models/User');

                    // 1. Deduct 100rs from provider's wallet
                    let wallet = await Wallet.findOne({ providerId: req.user._id });
                    if (!wallet) {
                        wallet = await Wallet.create({ providerId: req.user._id, balance: 0 });
                    }
                    wallet.balance -= penalty;
                    wallet.updatedAt = Date.now();
                    await wallet.save();

                    // Sync provider's wallet balance
                    const provider = await Provider.findById(req.user._id);
                    if (provider) {
                        provider.walletBalance = wallet.balance;
                        await provider.save();
                    }

                    await Transaction.create({
                        providerId: req.user._id,
                        title: 'Cancellation Penalty',
                        amount: penalty,
                        type: 'debit',
                        status: 'completed',
                        bookingId: booking._id,
                        description: 'Penalty for cancelling a booking'
                    });

                    // 2. Send 50 to the user (customer)
                    let userWallet = await Wallet.findOne({ userId: booking.userId });
                    if (!userWallet) {
                        userWallet = await Wallet.create({ userId: booking.userId, balance: 0 });
                    }
                    userWallet.balance += creditAmount;
                    userWallet.updatedAt = Date.now();
                    await userWallet.save();

                    await Transaction.create({
                        userId: booking.userId,
                        title: 'Cancellation Compensation',
                        amount: creditAmount,
                        type: 'credit',
                        status: 'completed',
                        bookingId: booking._id,
                        description: 'Compensation for booking cancelled by partner'
                    });

                    // Send notification to the user about the cancellation compensation
                    try {
                        const { notifyUser } = require('../config/notificationService');
                        await notifyUser({
                            userId: booking.userId,
                            userRole: 'user',
                            title: 'Booking Cancelled by Partner',
                            message: `Your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been cancelled by the partner. ₹${creditAmount} has been credited to your wallet.`,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } catch (notifyErr) {
                        console.log('User cancel notification failed (skipping):', notifyErr.message);
                    }

                    // 3. Send 50 to the admin
                    const adminUser = await User.findOne({ role: { $in: ['superadmin', 'admin'] } });
                    if (adminUser) {
                        let adminWallet = await Wallet.findOne({ userId: adminUser._id });
                        if (!adminWallet) {
                            adminWallet = await Wallet.create({ userId: adminUser._id, balance: 0 });
                        }
                        adminWallet.balance += creditAmount;
                        adminWallet.updatedAt = Date.now();
                        await adminWallet.save();

                        await Transaction.create({
                            userId: adminUser._id,
                            title: 'Cancellation Platform Share',
                            amount: creditAmount,
                            type: 'credit',
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Platform share of booking cancellation penalty from partner ${req.user.ownerName || ''}`
                        });
                    }

                    // 4. Notify admin(s)
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
                    console.log('Cancellation penalty/distribution failed:', err.message);
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
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    // Refetch booking and provider with session
                    const bookingSession = await Booking.findById(booking._id).session(session);
                    // Check idempotency:
                    if (bookingSession.status === 'completed') {
                        await session.commitTransaction();
                        session.endSession();
                        return res.json({
                            message: 'Service completed successfully (idempotent)',
                            status: 'completed',
                            payout: bookingSession.providerPayout,
                            commission: bookingSession.adminCommission
                        });
                    }

                    const provider = await Provider.findById(booking.providerId).populate('vendorType').session(session);

                    const CommissionRuleEngine = require('../services/CommissionRuleEngine');
                    const CommissionService = require('../services/CommissionService');
                    const FinancialLedger = require('../models/FinancialLedger');
                    const CommissionLog = require('../models/CommissionLog');
                    const PartnerProgram = require('../models/PartnerProgram');

                    let adminCommission = 0;
                    let providerPayout = booking.totalAmount;
                    let commissionStatus = 'free';
                    let calculation = null;
                    const txnId = `TXN-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;
                    const commTxnId = `COM-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;

                    let travelChargeAmount = 0;
                    if (booking.travelCharge && booking.travelCharge.status === 'final') {
                        travelChargeAmount = booking.travelCharge.amount || 0;
                    }
                    const commissionableAmount = Math.max(0, booking.totalAmount - travelChargeAmount);

                    if (provider.providerCategory === 'sewak') {
                        adminCommission = commissionableAmount;
                        providerPayout = travelChargeAmount;
                        commissionStatus = 'sewak_revenue';
                    } else {
                        const matchedRule = await CommissionRuleEngine.selectRule(commissionableAmount, provider, provider.vendorType);
                        calculation = CommissionService.calculate(commissionableAmount, matchedRule);
                        adminCommission = calculation.platformAmount;
                        providerPayout = calculation.providerAmount + travelChargeAmount;
                        commissionStatus = calculation.source.toLowerCase();

                        // Increment trial usedServices
                        if (calculation.source === 'FREE_TRIAL') {
                            provider.freeTrial.usedServices += 1;
                            const program = await PartnerProgram.findOne().session(session);
                            const totalTrial = program ? program.freeServiceCount : 3;
                            if (provider.freeTrial.usedServices >= (totalTrial + provider.freeTrial.extraFreeServices)) {
                                provider.freeTrial.trialCompletedAt = Date.now();
                            }
                        }
                        // Increment waiver counts
                        if (calculation.source === 'WAIVER') {
                            provider.commissionWaiver.bookingsWaivedCount += 1;
                        }
                    }

                    // Increment bookingsCount
                    if (provider.providerCategory !== 'sewak') {
                        provider.bookingsCount = (provider.bookingsCount || 0) + 1;
                    }

                    // Save snapshot on booking
                    bookingSession.status = 'completed';
                    bookingSession.completedAt = Date.now();
                    if (afterImage) {
                        bookingSession.afterImage = afterImage;
                    }
                    bookingSession.adminCommission = adminCommission;
                    bookingSession.providerPayout = providerPayout;
                    bookingSession.commissionStatus = commissionStatus;
                    bookingSession.transactionId = txnId;
                    bookingSession.commissionTransactionId = commTxnId;

                    if (calculation) {
                        const program = await PartnerProgram.findOne().session(session);
                        bookingSession.commissionSnapshot = {
                            partnerProgramVersion: program ? program.ruleVersion : 1,
                            commissionRuleId: calculation.source,
                            commissionRuleName: calculation.ruleApplied,
                            commissionSource: calculation.source,
                            providerOverrideUsed: calculation.source === 'PROVIDER_OVERRIDE',
                            waiverApplied: calculation.source === 'WAIVER',
                            bookingCategorySnapshot: {
                                id: provider.vendorType ? provider.vendorType._id : null,
                                name: provider.vendorType ? provider.vendorType.name : 'Global Default',
                                nightChargePercent: provider.vendorType ? provider.vendorType.nightChargePercent : 0
                            },
                            providerSnapshot: {
                                id: provider._id,
                                ownerName: provider.ownerName,
                                shopName: provider.shopName
                            },
                            subscriptionSnapshot: calculation.subscriptionSnapshot || null,
                            commissionPercentage: calculation.commissionRate,
                            commissionAmount: calculation.commissionAmount,
                            providerEarnings: calculation.providerAmount,
                            platformEarnings: calculation.platformAmount,
                            calculatedAt: Date.now()
                        };
                    }

                    // Update wallet and record ledger
                    const { Wallet, Transaction } = require('../models/Wallet');
                    let wallet = await Wallet.findOne({ providerId: provider._id }).session(session);
                    if (!wallet) {
                        const createdWallets = await Wallet.create([{ providerId: provider._id, balance: 0 }], { session });
                        wallet = createdWallets[0];
                    }

                    let transactionAmount = 0;
                    let transactionType = 'credit';
                    let transactionTitle = '';

                    const prevDuesBalance = wallet.balance;
                    const prevAvailableBalance = wallet.availableBalance || 0;

                    if (booking.paymentMode !== 'now') {
                        wallet.balance -= adminCommission;
                        transactionAmount = adminCommission;
                        transactionType = 'debit';
                        transactionTitle = `Commission Deducted: ${booking.serviceName}`;

                        await FinancialLedger.create([{
                            transactionId: txnId,
                            commissionTransactionId: commTxnId,
                            booking: booking._id,
                            provider: provider._id,
                            ledgerType: 'COMMISSION',
                            amount: -adminCommission,
                            previousBalance: prevDuesBalance,
                            newBalance: wallet.balance,
                            description: `Cash Commission dues for booking #${booking._id.toString().slice(-6)}`,
                            metadata: { paymentMode: booking.paymentMode }
                        }], { session });
                    } else {
                        wallet.availableBalance = prevAvailableBalance + providerPayout;

                        // Separate Service Earnings from Travel Charge
                        const travelChargePortion = (bookingSession.travelCharge && bookingSession.travelCharge.status === 'final') ? (bookingSession.travelCharge.amount || 0) : 0;
                        const serviceEarningsPortion = providerPayout - travelChargePortion;

                        transactionAmount = serviceEarningsPortion;
                        transactionType = 'credit';
                        transactionTitle = `Service Earnings: ${booking.serviceName}`;

                        await FinancialLedger.create([{
                            transactionId: txnId,
                            commissionTransactionId: commTxnId,
                            booking: booking._id,
                            provider: provider._id,
                            ledgerType: 'WALLET_CREDIT',
                            amount: providerPayout,
                            previousBalance: prevAvailableBalance,
                            newBalance: wallet.availableBalance,
                            description: `Payout credit for booking #${booking._id.toString().slice(-6)}`,
                            metadata: { paymentMode: booking.paymentMode, travelCharge: travelChargePortion, serviceEarnings: serviceEarningsPortion }
                        }], { session });
                    }

                    wallet.updatedAt = Date.now();
                    await wallet.save({ session });

                    // Create legacy transaction log
                    const transactionsToCreate = [];

                    // 1. Service Earnings
                    if (transactionType === 'credit') {
                        transactionsToCreate.push({
                            providerId: provider._id,
                            title: transactionTitle,
                            amount: transactionAmount,
                            type: transactionType,
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Booking ID #${booking._id.toString().slice(-6)}`
                        });
                    } else if (transactionType === 'debit') {
                        // Commission debit
                        transactionsToCreate.push({
                            providerId: provider._id,
                            title: transactionTitle,
                            amount: transactionAmount,
                            type: transactionType,
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Booking ID #${booking._id.toString().slice(-6)}`
                        });
                    }

                    // 2. Travel Charge
                    if (bookingSession.travelCharge && bookingSession.travelCharge.status === 'final' && bookingSession.travelCharge.amount > 0) {
                        transactionsToCreate.push({
                            providerId: provider._id,
                            title: `Travel Charge: ${booking.serviceName}`,
                            amount: bookingSession.travelCharge.amount,
                            type: 'credit',
                            status: 'completed',
                            bookingId: booking._id,
                            description: `Travel Charge for Booking ID #${booking._id.toString().slice(-6)}`
                        });
                    }

                    for (const txn of transactionsToCreate) {
                        const newTxn = new Transaction(txn);
                        await newTxn.save({ session });
                    }

                    // Create commission log
                    if (calculation) {
                        const newLog = new CommissionLog({
                            booking: booking._id,
                            provider: provider._id,
                            appliedRule: calculation.ruleApplied,
                            appliedPercentage: calculation.commissionRate,
                            platformEarnings: calculation.platformAmount,
                            providerEarnings: calculation.providerAmount,
                            triggerEvent: 'BOOKING_COMPLETED'
                        });
                        await newLog.save({ session });
                    }

                    provider.walletBalance = wallet.balance;
                    await provider.save({ session });
                    await bookingSession.save({ session });

                    await session.commitTransaction();
                    session.endSession();

                    // --- Trigger Notifications & Sewak incentives after transaction commits ---
                    try {
                        const { notifyUser } = require('../config/notificationService');
                        await notifyUser({
                            userId: booking.providerId,
                            userRole: 'provider',
                            title: 'Booking Completed ✓',
                            message: `Your booking #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been successfully completed.`,
                            type: 'booking',
                            bookingId: booking._id
                        });

                        await notifyUser({
                            userId: booking.userId,
                            userRole: 'user',
                            title: 'Booking Completed ✓',
                            message: `Your service #${booking._id.toString().slice(-6)} for ${booking.serviceName} has been completed.`,
                            type: 'booking',
                            bookingId: booking._id
                        });
                    } catch (notiErr) {
                        console.error('[Notification Trigger Error] Failed to send completion notification:', notiErr);
                    }

                    try {
                        const { sendNotificationToUser } = require('../config/notificationService');
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
                    } catch (pushErr) {
                        console.log('Push notification failed (skipping):', pushErr.message);
                    }

                    // Incentives trigger for Sewak
                    if (provider.providerCategory === 'sewak') {
                        try {
                            const today = new Date().toISOString().split('T')[0];
                            const threshold = 5;
                            const bonusAmount = 50;

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
                                await SewakIncentiveLog.create({
                                    sewakId: provider._id,
                                    bookingId: booking._id,
                                    date: today,
                                    dailyBookingCount: dailyCount,
                                    bonusEarned: bonusAmount
                                });

                                let wSession = await Wallet.findOne({ providerId: provider._id });
                                if (wSession) {
                                    wSession.balance += bonusAmount;
                                    await wSession.save();
                                    await Transaction.create({
                                        providerId: provider._id,
                                        title: `Daily Performance Bonus`,
                                        amount: bonusAmount,
                                        type: 'credit',
                                        status: 'completed',
                                        bookingId: booking._id,
                                        description: `Incentive for completing ${dailyCount} bookings today`
                                    });
                                    provider.walletBalance = wSession.balance;
                                    await provider.save();
                                }
                            }
                        } catch (incError) {
                            console.error("Incentive Calculation Error:", incError);
                        }
                    }

                    return res.json({
                        message: 'Service completed successfully',
                        status: 'completed',
                        payout: providerPayout,
                        commission: adminCommission
                    });

                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    throw error;
                }
            } else {
                return res.status(400).json({ message: 'Invalid OTP' });
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
