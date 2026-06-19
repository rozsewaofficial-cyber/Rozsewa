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

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
    const { providerId, serviceName, serviceId, bookingDate, bookingTime, totalAmount, address, couponCode, discountAmount, paymentMode } = req.body;

    try {
        let finalTotalAmount = totalAmount;
        let nightChargeAmount = 0;
        let appliedNightChargePercent = 0;

        // --- Night Charge Logic ---
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
                            nightChargeAmount = (totalAmount * percent) / 100;
                            finalTotalAmount = totalAmount + nightChargeAmount;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Night charge calculation error:", err);
        }

        const booking = await Booking.create({
            userId: req.user._id,
            providerId,
            serviceName,
            serviceId,
            bookingDate,
            bookingTime,
            totalAmount: finalTotalAmount,
            address,
            location: req.body.location,
            couponCode,
            discountAmount,
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

            // If no specific provider was requested or found online, use radius or fallback
            if (providersToNotify.length === 0) {
                if (!booking.location || !booking.location.coordinates || booking.location.coordinates.length < 2) {
                    console.log('FAILED: Booking has no valid coordinates. Dispatching to ALL online providers as fallback...');
                    providersToNotify = await Provider.find({ status: 'verified', isOnline: true });
                } else {
                    providersToNotify = await Provider.find({
                        status: 'verified',
                        isOnline: true,
                        location: {
                            $geoWithin: {
                                $centerSphere: [booking.location.coordinates, radiusInRadians]
                            }
                        }
                    });
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
                    address: booking.address,
                    userName: req.user.name,
                    paymentMode: booking.paymentMode,
                    bookingDate: booking.bookingDate,
                    bookingTime: booking.bookingTime,
                    expiresAt: new Date(Date.now() + 2 * 60 * 1000)
                });

                // Persistence (Optional but good) - assuming Notification model exists
                try {
                    const Notification = require('../models/Notification');
                    await Notification.create({
                        recipientId: provider._id,
                        recipientModel: 'Provider',
                        title: 'Urgent: Service Request!',
                        message: `New request for ${booking.serviceName} at ${booking.address}`,
                        type: 'booking',
                        bookingId: booking._id
                    });

                    // Push Notification (English)
                    const { sendNotificationToUser } = require('../config/notificationService');
                    await sendNotificationToUser(provider._id, 'provider', {
                        title: 'Urgent: Service Request!',
                        body: `You received a new request for ${booking.serviceName}. Accept now!`,
                        data: {
                            type: 'booking',
                            id: booking._id.toString(),
                            link: `/provider/bookings`
                        }
                    });
                } catch (err) {
                    console.log('Notification persistence failed (skipping):', err.message);
                }
            }

            console.log('--- END DEBUG ---');

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
            const { status, bookingDate, bookingTime } = req.body;

            booking.status = status || booking.status;
            booking.bookingDate = bookingDate || booking.bookingDate;
            booking.bookingTime = bookingTime || booking.bookingTime;

            const updatedBooking = await booking.save();

            // Push Notification if cancelled
            if (status === 'cancelled' && booking.providerId) {
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');
                    await sendNotificationToUser(booking.providerId, 'provider', {
                        title: 'Booking Cancelled',
                        body: `User has cancelled booking ID #${booking._id.toString().slice(-6)}.`,
                        data: {
                            type: 'booking',
                            id: booking._id.toString(),
                            link: `/provider/bookings`
                        }
                    });
                } catch (err) {
                    console.log('Push notification failed (skipping):', err.message);
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
            const isAccepting = req.body.status === 'confirmed';

            const isAuthorized = (isAccepting && !booking.providerId) ||
                (booking.providerId && booking.providerId.toString() === req.user._id.toString()) ||
                (booking.userId && booking.userId.toString() === req.user._id.toString());
            if (!isAuthorized) {
                return res.status(401).json({ message: 'Not authorized for this booking' });
            }

            const newStatus = req.body.status || booking.status;

            // Assign provider if accepting
            if (isAccepting && !booking.providerId) {
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

                    // Override by category
                    if (provider && provider.vendorType) {
                        const catId = provider.vendorType.toString();
                        const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
                        if (catLimitObj) limit = Number(catLimitObj.limit);
                    }

                    // Override by service
                    // Since bookings might have multiple services or just serviceId.
                    // Assuming booking.services array or booking.serviceId exists.
                    // (Some apps use booking.services, others serviceId. If services is an array, we take max or min. Let's use the first one or serviceId).
                    const bookingServiceId = booking.serviceId ? booking.serviceId.toString() : (booking.services && booking.services.length > 0 ? booking.services[0].serviceId?.toString() : null);

                    if (bookingServiceId) {
                        const srvLimitObj = cfg.serviceLimits?.find(s => s.serviceId === bookingServiceId);
                        if (srvLimitObj) limit = Number(srvLimitObj.limit);
                    }
                }

                if (wallet && wallet.balance <= -limit) {
                    return res.status(403).json({ message: `Please settle your wallet dues to accept new bookings.` });
                }

                booking.providerId = req.user._id;
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
                        wallet.balance += booking.providerPayout;
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

                // Notify User with OTP
                await Notification.create({
                    recipientId: booking.userId,
                    recipientModel: 'User',
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

                // Notify User with Completion OTP
                await Notification.create({
                    recipientId: booking.userId,
                    recipientModel: 'User',
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

            // If confirmed, notify other potential providers to stop their alarms
            if (newStatus === 'confirmed') {
                const io = require('../config/socket').getIO();
                // We don't have the original dispatch list here easily, 
                // but we can broadcast it or just rely on the fact that 
                // it emits to a room or we can find who was notified.
                // For simplicity, we can emit a global event for this booking ID
                // or use a 'dispatch' room if we had one.
                // Since each provider is in their own room, we broadcast to everyone
                // or we could track notified providers in the booking model.
                io.emit('BOOKING_TAKEN', { bookingId: booking._id.toString() });
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
                    const plan = provider.planType || 'none';

                    if (plan === 'elite') rate = config.subscriptionPlans.elite.commissionRate;
                    else if (plan === 'pro') rate = config.subscriptionPlans.pro.commissionRate;
                    else if (plan === 'basic') rate = config.subscriptionPlans.basic.commissionRate;
                    else {
                        // Amount Slabs by Category
                        const amt = booking.totalAmount;
                        const providerCategoryId = provider.vendorType?._id?.toString() || provider.vendorType?.toString();

                        let matchingSlabs = config.commissionSlabs.filter(s => s.categoryId === providerCategoryId);
                        if (matchingSlabs.length === 0) {
                            matchingSlabs = config.commissionSlabs.filter(s => !s.categoryId || s.categoryId === 'default' || s.categoryId === '');
                        }

                        const slab = matchingSlabs.find(s => amt >= s.min && amt <= s.max);
                        rate = slab ? slab.rate : (matchingSlabs.length > 0 ? matchingSlabs[0].rate : 10);
                    }

                    // Attendance Bonus Discount
                    if (provider.attendanceBonusActive) {
                        rate = Math.max(0, rate - config.attendance.discountRate);
                    }

                    adminCommission = (booking.totalAmount * rate) / 100;
                    providerPayout = booking.totalAmount - adminCommission;
                    commissionStatus = plan !== 'none' ? `subscription_${plan}` : 'slab_commission';
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
                    // Provider collected cash, deduct commission
                    wallet.balance -= adminCommission;
                    transactionAmount = adminCommission;
                    transactionType = 'debit';
                    transactionTitle = `Commission Deducted: ${booking.serviceName}`;
                } else {
                    // Online payment to admin, credit provider payout
                    wallet.balance += providerPayout;
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
    checkOverlapStatus
};
