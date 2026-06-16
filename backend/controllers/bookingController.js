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
            .populate('providerId', 'shopName ownerName rating mobile profileImage')
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
                booking.providerId = req.user._id;
            }
            
            if (req.body.paymentStatus) {
                booking.paymentStatus = req.body.paymentStatus;
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
                    } catch (err) {}
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

                wallet.balance += providerPayout;
                wallet.updatedAt = Date.now();

                const transaction = await Transaction.create({
                    providerId: provider._id,
                    title: `Service Earnings: ${booking.serviceName}`,
                    amount: providerPayout,
                    type: 'credit',
                    status: 'completed',
                    bookingId: booking._id,
                    description: `Booking ID #${booking._id.toString().slice(-6)}`
                });

                provider.walletBalance = wallet.balance;

                // Push Notification for Provider
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');
                    
                    // 1. Wallet Credited (If payout > 0)
                    if (providerPayout > 0) {
                        await sendNotificationToUser(booking.providerId, 'provider', {
                            title: 'Wallet Credited!',
                            body: `₹${providerPayout} credited to your wallet for booking #${booking._id.toString().slice(-6)}.`,
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
    submitReview
};
