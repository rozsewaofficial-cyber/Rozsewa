const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Provider = require('../models/Provider');
const Employee = require('../models/Employee');
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
            if (booking.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized for this booking' });
            }

            const newStatus = req.body.status || booking.status;

            // Generate OTP if status is changed to 'on_the_way'
            if (newStatus === 'on_the_way' && !booking.startOTP) {
                const otp = Math.floor(1000 + Math.random() * 9000).toString();
                booking.startOTP = otp;

                // Notify Provider with OTP
                await Notification.create({
                    recipientId: req.user._id,
                    recipientModel: 'Provider',
                    title: 'Start OTP Generated',
                    message: `Customer OTP to START service #${booking._id.toString().slice(-6)} is: ${otp}.`,
                    type: 'system',
                    bookingId: booking._id
                });
            }

            // Generate End OTP if Provider tries to complete but needs verification
            if (newStatus === 'completed' && booking.status === 'started' && !booking.endOTP) {
                const otp = Math.floor(1000 + Math.random() * 9000).toString();
                booking.endOTP = otp;
                await booking.save();

                return res.json({
                    message: 'Completion OTP generated. Share this with customer to finish.',
                    endOTP: otp,
                    status: 'started' // Keep as started until verified
                });
            }

            booking.status = newStatus;
            const updatedBooking = await booking.save();

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

            // Payment check for Online Payments
            if (booking.paymentMode === 'now' && booking.paymentStatus !== 'paid') {
                return res.status(400).json({ message: 'Customer has not paid yet. Please ask them to pay from their app.' });
            }

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

                const Setting = require('../models/Setting');
                let commissionRate = 10; // Default fallback

                try {
                    const commissionSetting = await Setting.findOne({ key: 'commissionRate' });
                    if (commissionSetting) {
                        commissionRate = parseFloat(commissionSetting.value);
                    }
                } catch (err) {
                    console.log("Error fetching global commission setting, using default 10%");
                }

                let adminCommission = 0;
                let providerPayout = booking.totalAmount;
                let commissionStatus = 'free';

                if (provider.providerCategory === 'sewak') {
                    adminCommission = booking.totalAmount;
                    providerPayout = 0;
                    commissionStatus = 'sewak_revenue';
                } else if (provider.freeServicesLeft > 0) {
                    provider.freeServicesLeft -= 1;
                } else if (provider.isSubscribed && provider.subscriptionExpiry && new Date(provider.subscriptionExpiry) > new Date()) {
                    // Subscription Logic (e.g., 5%)
                    const rate = provider.subscriptionRate || 5;
                    const type = provider.subscriptionType || 'percentage';

                    if (type === 'percentage') {
                        adminCommission = (booking.totalAmount * rate) / 100;
                    } else {
                        adminCommission = rate; // Fixed amount
                    }
                    providerPayout = booking.totalAmount - adminCommission;
                    commissionStatus = 'subscription_discount';
                } else {
                    // Use category-specific tier commission with fallbacks to global settings
                    const category = provider.vendorType;
                    const planType = provider.planType || 'basic';
                    
                    // Fetch global default for this tier from settings
                    const tierKey = `commission_${planType}`;
                    const Setting = require('../models/Setting');
                    let defaultRate = planType === 'premium' ? 15 : planType === 'standard' ? 20 : 25; // Hardcoded fallbacks
                    
                    try {
                        const tierSetting = await Setting.findOne({ key: tierKey });
                        if (tierSetting) {
                            defaultRate = parseFloat(tierSetting.value);
                        }
                    } catch (err) {
                        console.log(`Error fetching global ${tierKey} setting`);
                    }

                    let rate = defaultRate;
                    if (category) {
                        if (planType === 'premium') {
                            rate = category.partnerCommissionPremium ?? defaultRate;
                        } else if (planType === 'standard') {
                            rate = category.partnerCommissionStandard ?? defaultRate;
                        } else {
                            rate = category.partnerCommissionBasic ?? defaultRate;
                        }
                    }
                    
                    adminCommission = (booking.totalAmount * rate) / 100;
                    providerPayout = booking.totalAmount - adminCommission;
                    commissionStatus = 'commissioned';
                    
                    console.log(`Applied commission (${rate}%) for plan: ${planType}, category: ${category?.name || 'None'}`);
                }

                // Update booking with commission details
                booking.status = 'completed';
                booking.afterImage = afterImage;
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
                    description: commissionStatus === 'free' ? 'Zero Commission Booking' :
                        commissionStatus === 'subscription_discount' ? `Subscription Discount Applied (${provider.subscriptionRate || 5}${provider.subscriptionType === 'fixed' ? ' Fixed' : '%'})` :
                            `Tiered Commission Applied (${provider.planType || 'basic'})`
                });

                provider.walletBalance = wallet.balance;

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

module.exports = {
    createBooking,
    getUserBookings,
    getProviderBookings,
    updateBooking,
    updateBookingStatusByProvider,
    verifyStartOTP,
    verifyEndOTP,
    getProviderReviews
};
