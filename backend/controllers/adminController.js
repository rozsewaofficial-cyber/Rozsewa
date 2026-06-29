const Provider = require('../models/Provider');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Category = require('../models/Category');
const AuditLog = require('../models/AuditLog');
const SewakIncentiveLog = require('../models/SewakIncentiveLog');
const axios = require('axios');
// Trigger restart

// @desc    Get all providers for admin
// @route   GET /api/admin/providers
// @access  Private/Admin
const getProviders = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        query.providerCategory = { $ne: 'sewak' };
        const providers = await Provider.find(query).sort({ createdAt: -1 });
        res.json(providers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update provider status (Verify/Reject)
// @route   PUT /api/admin/providers/:id/status
// @access  Private/Admin
const updateProviderStatus = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        provider.status = req.body.status || provider.status;

        // If admin verifies the provider, auto-verify current documents as well
        if (req.body.status === 'verified' && provider.documents) {
            provider.documents.forEach(doc => {
                if (doc.status === 'pending') {
                    doc.status = 'verified';
                }
            });
            provider.kycVerified = true;
        }

        const updatedProvider = await provider.save();

        // Push Notification for KYC Update
        if (req.body.status === 'verified' || req.body.status === 'rejected') {
            try {
                const { sendNotificationToUser } = require('../config/notificationService');
                const message = req.body.status === 'verified'
                    ? 'Your KYC is approved! You can start working now.'
                    : 'Your KYC request was rejected. Please check your documents.';

                await sendNotificationToUser(provider._id, 'provider', {
                    title: `KYC ${req.body.status === 'verified' ? 'Approved' : 'Rejected'}`,
                    body: message,
                    data: {
                        type: 'kyc',
                        id: provider._id.toString(),
                        link: '/provider/profile'
                    }
                });
            } catch (err) {
                console.log('Push notification failed (skipping):', err.message);
            }
        }

        // Log Verification Action
        if (req.body.status) {
            await AuditLog.create({
                actionType: req.body.status === 'verified' ? "VERIFY" : "REJECT",
                entityType: provider.providerCategory === 'sewak' ? "SEWAK" : "VENDOR",
                entityId: provider._id,
                entityName: provider.shopName,
                verifiedBy: req.user._id,
                verifiedByName: req.user.name,
                verifiedByRole: req.user.role,
                details: { status: req.body.status, action: 'status_update' }
            });

            // If it's a verification, also log a KYC event
            if (req.body.status === 'verified') {
                await AuditLog.create({
                    actionType: "VERIFY",
                    entityType: "KYC",
                    entityId: provider._id,
                    entityName: `${provider.ownerName} - KYC`,
                    verifiedBy: req.user._id,
                    verifiedByName: req.user.name,
                    verifiedByRole: req.user.role,
                    details: { status: 'verified' }
                });
            }
        }

        res.json(updatedProvider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update provider category role (Partner/Sewak)
// @route   PUT /api/admin/providers/:id/category-role
// @access  Private/Admin
const updateProviderCategory = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Enforce business rule: Sewak cannot be converted back to Partner
        if (provider.providerCategory === 'sewak' && req.body.providerCategory === 'partner') {
            return res.status(400).json({ message: 'Sewak providers cannot be converted back to Partner.' });
        }

        if (req.body.providerCategory !== undefined) { provider.providerCategory = req.body.providerCategory; } if (req.body.vendorType !== undefined) { provider.vendorType = req.body.vendorType; }
        const updatedProvider = await provider.save();
        res.json(updatedProvider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = async (req, res) => {
    try {
        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (!supervisorEmp) {
                return res.json({
                    totalProviders: 0,
                    pendingProviders: 0,
                    totalUsers: 0,
                    totalBookings: 0,
                    activeBookings: 0,
                    revenue: 0,
                    recentBookings: []
                });
            }

            const employees = await Employee.find({ 
                $or: [
                    { managedBy: supervisorEmp._id },
                    { supervisorCode: supervisorEmp.ownCode },
                    { createdBy: req.user._id }
                ]
            });
            const employeeCodes = employees.map(emp => emp.ownCode).filter(Boolean);
            const teamCodes = [supervisorEmp.ownCode, ...employeeCodes].filter(Boolean);

            const teamSewaks = await Provider.find({
                providerCategory: 'sewak',
                $or: [
                    { referredBy: { $in: teamCodes } },
                    { onboardedByStaff: { $in: teamCodes } }
                ]
            });
            const sewakIds = teamSewaks.map(s => s._id);

            const pendingSewaksCount = teamSewaks.filter(s => s.status === 'pending').length;

            const totalBookings = await Booking.countDocuments({ providerId: { $in: sewakIds } });
            const activeBookings = await Booking.countDocuments({ 
                providerId: { $in: sewakIds },
                status: { $in: ['pending', 'active'] }
            });

            const revenueData = await Booking.aggregate([
                { $match: { providerId: { $in: sewakIds }, status: 'completed' } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const revenue = revenueData.length > 0 ? revenueData[0].total : 0;

            const recentBookingsRaw = await Booking.find({ providerId: { $in: sewakIds } })
                .populate('userId', 'name')
                .populate('providerId', 'shopName')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();

            const recentBookings = recentBookingsRaw.map(b => ({
                id: b.bookingId || b._id.toString().slice(-6).toUpperCase(),
                user: b.userId?.name || 'Customer',
                provider: b.providerId?.shopName || 'Provider',
                service: b.serviceName || 'Service',
                amount: b.amount,
                status: b.status,
                date: new Date(b.createdAt).toLocaleDateString(),
                time: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            return res.json({
                totalProviders: teamSewaks.length,
                pendingProviders: pendingSewaksCount,
                totalUsers: employees.length,
                totalBookings,
                activeBookings,
                revenue,
                recentBookings
            });
        }

        // Global stats for admin/superadmin
        const totalProviders = await Provider.countDocuments();
        const pendingProviders = await Provider.countDocuments({ status: 'pending' });
        const totalUsers = await User.countDocuments();
        const totalBookings = await Booking.countDocuments();
        const activeBookings = await Booking.countDocuments({ status: { $in: ['pending', 'active'] } });

        // Calculate Revenue (Sum of all completed booking amounts)
        const revenueData = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const revenue = revenueData.length > 0 ? revenueData[0].total : 0;

        // Fetch Recent Bookings
        const recentBookingsRaw = await Booking.find()
            .populate('userId', 'name')
            .populate('providerId', 'shopName')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const recentBookings = recentBookingsRaw.map(b => ({
            id: b.bookingId || b._id.toString().slice(-6).toUpperCase(),
            user: b.userId?.name || 'Customer',
            provider: b.providerId?.shopName || 'Provider',
            service: b.serviceName || 'Service',
            amount: b.amount,
            status: b.status,
            date: new Date(b.createdAt).toLocaleDateString(),
            time: new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        res.json({
            totalProviders,
            pendingProviders,
            totalUsers,
            totalBookings,
            activeBookings,
            revenue,
            recentBookings
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all bookings for admin
// @route   GET /api/admin/bookings
// @access  Private/Admin
const getBookings = async (req, res) => {
    try {
        const { status } = req.query;
        let query = status ? { status } : {};

        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (supervisorEmp) {
                const employees = await Employee.find({ 
                    $or: [
                        { managedBy: supervisorEmp._id },
                        { supervisorCode: supervisorEmp.ownCode },
                        { createdBy: req.user._id }
                    ]
                });
                const employeeCodes = employees.map(emp => emp.ownCode).filter(Boolean);
                const teamCodes = [supervisorEmp.ownCode, ...employeeCodes].filter(Boolean);

                const teamSewaks = await Provider.find({
                    providerCategory: 'sewak',
                    $or: [
                        { referredBy: { $in: teamCodes } },
                        { onboardedByStaff: { $in: teamCodes } }
                    ]
                });
                const sewakIds = teamSewaks.map(s => s._id);
                query.providerId = { $in: sewakIds };
            } else {
                return res.json([]);
            }
        }

        const bookings = await Booking.find(query)
            .populate('userId', 'name email mobile')
            .populate('providerId', 'shopName ownerName mobile')
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a booking
// @route   DELETE /api/admin/bookings/:id
// @access  Private/Admin
const deleteBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        await Booking.findByIdAndDelete(req.params.id);

        // Log Action
        await AuditLog.create({
            actionType: "DELETE",
            entityType: "BOOKING",
            entityId: booking._id,
            entityName: `Booking #${booking._id.toString().slice(-6)}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'delete_booking' }
        });

        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all provider reports/disputes
// @route   GET /api/admin/provider-reports
// @access  Private/Admin
const getProviderReports = async (req, res) => {
    try {
        // Fetch all bookings where adminRequest.status is 'pending'
        const reports = await Booking.find({ 'adminRequest.status': 'pending' })
            .populate('userId', 'name email mobile')
            .populate('providerId', 'shopName ownerName mobile')
            .sort({ 'adminRequest.requestedAt': -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resolve provider report
// @route   PATCH /api/admin/provider-reports/:id/resolve
// @access  Private/Admin
const resolveProviderReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { actionTaken, notes, blockUser } = req.body;

        const booking = await Booking.findById(id).populate('userId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        booking.adminRequest.status = 'resolved';
        // Add notes if needed later via AuditLog or inside adminRequest
        await booking.save();

        if (blockUser && booking.userId) {
            booking.userId.isActive = false;
            await booking.userId.save();
        }

        // Log the resolution
        await AuditLog.create({
            actionType: "RESOLVE_DISPUTE",
            entityType: "BOOKING",
            entityId: booking._id,
            entityName: `Dispute Resolution for Booking #${booking._id.toString().slice(-6)}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { actionTaken, notes, blockedUser: blockUser }
        });

        res.json({ message: 'Report resolved successfully', booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Service = require('../models/Service');
const Combo = require('../models/Combo');

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ index: 1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new category
// @route   POST /api/admin/categories
// @access  Private/Admin
const addCategory = async (req, res) => {
    try {
        const category = await Category.create(req.body);
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ message: 'Category not found' });

        if (req.body.name !== undefined) category.name = req.body.name;
        if (req.body.description !== undefined) category.description = req.body.description;
        if (req.body.icon !== undefined) category.icon = req.body.icon;
        if (req.body.image !== undefined) category.image = req.body.image;
        if (req.body.isActive !== undefined) category.isActive = req.body.isActive;
        if (req.body.isComingSoon !== undefined) category.isComingSoon = req.body.isComingSoon;
        if (req.body.partnerCommissionBasic !== undefined) category.partnerCommissionBasic = req.body.partnerCommissionBasic;
        if (req.body.partnerCommissionStandard !== undefined) category.partnerCommissionStandard = req.body.partnerCommissionStandard;
        if (req.body.partnerCommissionPremium !== undefined) category.partnerCommissionPremium = req.body.partnerCommissionPremium;

        if (req.body.services) {
            category.services = [];
            category.services.push(...req.body.services);
            category.markModified('services');
        }
        if (req.body.combos) {
            category.combos = [];
            category.combos.push(...req.body.combos);
            category.markModified('combos');
        }
        const updated = await category.save();

        // If Sewak pricing fields are present in services, sync them across all Sewak providers
        if (req.body.services) {
            try {
                const sewaks = await Provider.find({ providerCategory: 'sewak' }).select('_id');
                const sewakIds = sewaks.map(s => s._id);

                if (sewakIds.length > 0) {
                    for (const sub of updated.services) {
                        await Service.updateMany(
                            {
                                providerId: { $in: sewakIds },
                                name: sub.name,
                                category: updated.name
                            },
                            {
                                $set: {
                                    price: sub.basePrice ?? 299
                                }
                            }
                        );
                    }

                    // Sync Combo Pricing
                    if (updated.combos && updated.combos.length > 0) {
                        for (const comboTemplate of updated.combos) {
                            await Combo.updateMany(
                                {
                                    providerId: { $in: sewakIds },
                                    name: comboTemplate.name
                                },
                                {
                                    $set: { price: comboTemplate.sewakPrice || 0 }
                                }
                            );
                        }
                    }
                }
            } catch (syncError) {
                console.error("Failed to sync sewak prices:", syncError);
                // We don't fail the whole request, but log the error
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all users for admin
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        // Correcting the role factor: default role in User model is 'customer'
        const users = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle User (Customer) Block/Unblock
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.isActive = user.isActive === false ? true : false;
        await user.save();

        // Log Action
        await AuditLog.create({
            actionType: user.isActive ? "UNBLOCK" : "BLOCK",
            entityType: "USER",
            entityId: user._id,
            entityName: user.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: user.isActive ? 'active' : 'blocked' }
        });

        res.json({ success: true, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete User
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await User.findByIdAndDelete(req.params.id);

        // Log Action
        await AuditLog.create({
            actionType: "DELETE",
            entityType: "USER",
            entityId: user._id,
            entityName: user.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'delete_user' }
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const Banner = require('../models/Banner');

// @desc    Get all banners
// @route   GET /api/admin/banners
// @access  Private/Admin
const getBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ priority: -1 });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add new banner
// @route   POST /api/admin/banners
// @access  Private/Admin
const addBanner = async (req, res) => {
    try {
        const banner = await Banner.create(req.body);
        res.status(201).json(banner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete banner
// @route   DELETE /api/admin/banners/:id
// @access  Private/Admin
const deleteBanner = async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ message: 'Banner removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update banner
// @route   PUT /api/admin/banners/:id
// @access  Private/Admin
const updateBanner = async (req, res) => {
    try {
        const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(banner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle banner status
// @route   PATCH /api/admin/banners/:id/status
// @access  Private/Admin
const toggleBannerStatus = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: 'Banner not found' });

        banner.active = !banner.active;
        const updated = await banner.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Emergency Dashboard Data
// @route   GET /api/admin/emergency
// @access  Private/Admin
const getEmergencyData = async (req, res) => {
    try {
        const EmergencyAlert = require('../models/EmergencyAlert');
        // Actual SOS Alerts from Providers
        const activeSOS = await EmergencyAlert.find({ status: 'pending' })
            .populate('providerId', 'shopName ownerName profileImage mobile')
            .sort({ createdAt: -1 });

        const incomingSOSCount = activeSOS.length;
        const activeResponders = await Provider.countDocuments({ status: 'verified', isOnline: true });

        const responderStatus = await Provider.find({ status: 'verified' })
            .select('shopName address isOnline businessType')
            .limit(10);

        res.json({
            incomingSOS: incomingSOSCount,
            activeResponders,
            sosQueue: activeSOS, // Use actual SOS alerts here
            responderStatus
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Broadcast SOS to all active providers
// @route   POST /api/admin/emergency/broadcast
// @access  Private/Admin
const broadcastEmergency = async (req, res) => {
    try {
        const { message } = req.body;
        // Logic to notify providers (via socket or push notification)
        // For now, we simulate the broadcast success
        const activeRespondersCount = await Provider.countDocuments({ status: 'verified', isOnline: true });

        res.json({
            success: true,
            message: `Emergency broadcast sent to ${activeRespondersCount} active responders.`,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get 99 Card Management Data
// @route   GET /api/admin/99cards
// @access  Private/Admin
const get99CardData = async (req, res) => {
    try {
        const Setting = require('../models/Setting');
        const cardPriceSetting = await Setting.findOne({ key: 'vendorCardPrice' });
        const cardPrice = cardPriceSetting ? parseFloat(cardPriceSetting.value) : 99;

        const totalSales = await Provider.countDocuments();
        const activeSubscribers = await Provider.countDocuments({ status: 'verified' });
        const recentActivations = await Provider.find()
            .select('ownerName shopName joinedDate vendorCode employeeCode freeServicesLeft referredBy')
            .sort({ joinedDate: -1 })
            .limit(10);

        res.json({
            totalSales,
            activeSubscribers,
            totalRevenue: totalSales * cardPrice,
            recentActivations,
            cardPrice // Send card price to frontend too
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Feedback/Review Data
// @route   GET /api/admin/feedback
// @access  Private/Admin
const getFeedbackData = async (req, res) => {
    try {
        const reviews = await Booking.find({ rating: { $gt: 0 } })
            .populate('userId', 'name')
            .populate('providerId', 'shopName')
            .sort({ createdAt: -1 });

        // Transform for frontend
        const mappedReviews = reviews.map(r => ({
            id: r._id,
            author: r.userId?.name || 'Customer',
            role: 'user', // Default to user for now as schema supports one rating
            rating: r.rating,
            date: new Date(r.createdAt).toISOString().split('T')[0],
            comment: r.comment || 'No comment provided.',
            tags: r.rating >= 4 ? ['Good Service'] : ['Needs Attention'],
            provider: r.providerId?.shopName || 'Provider',
            acknowledged: false // This could be stored in DB later if needed
        }));

        res.json(mappedReviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Activity Logs
// @route   GET /api/admin/activity
// @access  Private/Admin
const getActivityLogs = async (req, res) => {
    try {
        const recentProviders = await Provider.find().sort({ joinedDate: -1 }).limit(10);
        const recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(10);

        const providerLogs = recentProviders.map(p => ({
            type: 'approval',
            action: `New Provider '${p.shopName}' reached out`,
            user: p.ownerName,
            time: p.joinedDate
        }));

        const bookingLogs = recentBookings.map(b => ({
            type: 'login',
            action: `Booking for ${b.serviceName} was placed`,
            user: 'System',
            time: b.createdAt
        }));

        const allLogs = [...providerLogs, ...bookingLogs].sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json(allLogs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Global Settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        const settings = await Setting.find();
        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        // Return with defaults if first time
        res.json({
            commissionRate: config.commissionRate || 10,
            minBookingAmount: config.minBookingAmount || 199,
            emergencyEnabled: config.emergencyEnabled !== undefined ? (config.emergencyEnabled === 'true' || config.emergencyEnabled === true) : true,
            autoAssign: config.autoAssign !== undefined ? (config.autoAssign === 'true' || config.autoAssign === true) : true,
            vendorCardEnabled: config.vendorCardEnabled !== undefined ? (config.vendorCardEnabled === 'true' || config.vendorCardEnabled === true) : true,
            vendorCardPrice: config.vendorCardPrice || 99,
            // New Tiered Commission Keys
            commission_basic: config.commission_basic || 25,
            commission_standard: config.commission_standard || 20,
            commission_premium: config.commission_premium || 15,
            // Subscriptions
            subscription_price: config.subscription_price || 999,
            subscription_commission_rate: config.subscription_commission_rate || 5,
            subscription_enabled: config.subscription_enabled !== undefined ? (config.subscription_enabled === 'true' || config.subscription_enabled === true) : true,
            terms: config.terms || "Standard Terms",
            privacy: config.privacy || "Standard Privacy",
            cancellation: config.cancellation || "Standard Cancellation",
            max_bargain_discount_limit: config.max_bargain_discount_limit !== undefined ? Number(config.max_bargain_discount_limit) : 20,
            adminProfile: {
                name: req.user.name,
                email: req.user.email,
                mobile: req.user.mobile
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Global Settings
// @route   POST /api/admin/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const { key, value } = req.body;

        if (key === 'max_bargain_discount_limit') {
            const numVal = Number(value);
            if (isNaN(numVal) || numVal < 0 || numVal > 90) {
                return res.status(400).json({ message: 'Max bargain discount limit must be between 0% and 90%.' });
            }
        }

        await Setting.findOneAndUpdate(
            { key },
            { value, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: `${key} updated` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Admin Profile
// @route   POST /api/admin/profile
// @access  Private/Admin
const updateAdminProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.mobile = req.body.mobile || user.mobile;
            await user.save();
            res.json({ success: true, message: "Profile updated" });
        } else {
            res.status(404).json({ message: "Admin not found" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const Promotion = require('../models/Promotion');

// @desc    Get all promotions
// @route   GET /api/admin/promotions
// @access  Private/Admin
async function getPromotions(req, res) {
    try {
        const promotions = await Promotion.find().sort({ createdAt: -1 });
        res.json(promotions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Create a promotion
// @route   POST /api/admin/promotions
// @access  Private/Admin
async function createPromotion(req, res) {
    try {
        const { title, promoCode, description } = req.body;
        const exists = await Promotion.findOne({ promoCode: promoCode.toUpperCase() });
        if (exists) return res.status(400).json({ message: 'Promo code already exists' });

        const promotion = await Promotion.create({
            title,
            promoCode: promoCode.toUpperCase(),
            description
        });
        res.status(201).json(promotion);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Delete a promotion
// @route   DELETE /api/admin/promotions/:id
// @access  Private/Admin
async function deletePromotion(req, res) {
    try {
        await Promotion.findByIdAndDelete(req.params.id);
        res.json({ message: 'Promotion removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const Zone = require('../models/Zone');

// @desc    Get all zones
// @route   GET /api/admin/zones
// @access  Private/Admin
async function getZones(req, res) {
    try {
        const zones = await Zone.find().sort({ createdAt: -1 });
        res.json(zones);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Add new zone
// @route   POST /api/admin/zones
// @access  Private/Admin
async function addZone(req, res) {
    try {
        const zone = await Zone.create(req.body);
        res.status(201).json(zone);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Delete zone
// @route   DELETE /api/admin/zones/:id
// @access  Private/Admin
async function deleteZone(req, res) {
    try {
        await Zone.findByIdAndDelete(req.params.id);
        res.json({ message: 'Zone removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const Employee = require('../models/Employee');

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private/Admin
async function getEmployees(req, res) {
    try {
        const { status } = req.query;
        let query = status ? { status } : {};

        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (supervisorEmp) {
                query = { ...query, $or: [{ managedBy: supervisorEmp._id }, { createdBy: req.user._id }] };
            } else {
                query = { ...query, createdBy: req.user._id };
            }
        }

        const employees = await Employee.find(query)
            .populate('userId')
            .populate('managedBy')
            .populate({ path: 'createdBy', select: 'name role' })
            .sort({ createdAt: -1 });

        const updatedEmployees = await Promise.all(employees.map(async (emp) => {
            let empObj = emp.toObject();
            
            // Check if managedBy was set to a User ID instead of an Employee ID, or if missing and created by supervisor
            if (!empObj.managedBy || !empObj.managedBy.ownCode) {
                const targetUserId = empObj.managedBy || (empObj.createdBy && empObj.createdBy.role === 'supervisor' ? empObj.createdBy._id : null);
                if (targetUserId) {
                    const supervisor = await Employee.findOne({ userId: targetUserId });
                    if (supervisor) {
                        empObj.managedBy = {
                            _id: supervisor._id,
                            ownCode: supervisor.ownCode,
                            name: supervisor.name
                        };
                    }
                }
            }
            return empObj;
        }));

        res.json(updatedEmployees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Add new employee (Supervisor, Field Staff, WFH)
// @route   POST /api/admin/employees
// @access  Private/Admin
async function addEmployee(req, res) {
    try {
        const { name, email, mobile, password, role, supervisorCode, registrationCommission, city, state, address, panCard, aadharCard, panCardPhoto, aadharCardPhoto, allowedCreationScope } = req.body;

        // Validation: Documents and numbers are required
        if (!panCard || !aadharCard || !panCardPhoto || !aadharCardPhoto) {
            return res.status(400).json({ message: 'PAN and Aadhaar numbers and photos are required' });
        }

        // Validation: State, City, and Address are required
        if (!state || !city || !address) {
            return res.status(400).json({ message: 'State, City, and Address are required' });
        }

        // 1. Hierarchy Validation and Restriction based on allowed scope
        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            const scope = supervisorEmp ? supervisorEmp.allowedCreationScope : 'employee_only';
            if (scope === 'all') {
                if (role !== 'employee' && role !== 'supervisor') {
                    return res.status(403).json({ message: 'Supervisors with "All" scope can only create Employees or Supervisors' });
                }
            } else {
                if (role !== 'employee') {
                    return res.status(403).json({ message: 'Supervisors can only create Employees' });
                }
            }
        } else if (req.user.role === 'admin' || req.user.role === 'superadmin') {
            if (role === 'employee' || role === 'field_staff') {
                if (role !== 'supervisor') {
                    return res.status(403).json({ message: 'Admin should only create Supervisors' });
                }
            }
        }

        // 2. Check if user already exists
        const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
        if (userExists) return res.status(400).json({ message: 'User already exists with this email or mobile' });

        // 3. Hierarchy Validation for Field Staff / Employees
        let managedBy = null;
        let supervisorId = null;
        let finalSupervisorCode = supervisorCode;

        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (supervisorEmp) {
                managedBy = supervisorEmp._id;
                finalSupervisorCode = supervisorEmp.ownCode;
            }
            supervisorId = req.user._id;
        } else if (role === 'field_staff' || role === 'employee') {
            if (supervisorCode) {
                const supervisor = await Employee.findOne({ ownCode: supervisorCode, role: 'supervisor' });
                if (supervisor) {
                    managedBy = supervisor._id;
                    supervisorId = supervisor.userId || supervisor._id;
                    finalSupervisorCode = supervisor.ownCode;
                }
            }
        }

        // 4. Generate Unique Code based on role
        const count = await Employee.countDocuments({ role });
        let prefix = 'REMP';
        if (role === 'supervisor') prefix = 'RSUP';
        else if (role === 'field_staff') prefix = 'RSTF';

        const ownCode = `${prefix}${1000 + count + 1}`;

        // 5. Create User Account for Login
        const user = await User.create({
            name,
            email,
            mobile,
            password: password || '123456',
            plainPassword: password || '123456',
            role: role || 'employee',
            city: city || 'Delhi',
            state: state || 'Delhi',
            address: address || '',
            createdBy: req.user._id,
            supervisorId: supervisorId
        });

        // 6. Create Employee Record linked to User
        const employee = await Employee.create({
            name,
            email,
            mobile,
            employeeId: ownCode,
            ownCode,
            userId: user._id,
            role: role || 'employee',
            supervisorCode: finalSupervisorCode,
            managedBy,
            registrationCommission: registrationCommission || 50,
            panCard,
            aadharCard,
            panCardPhoto,
            aadharCardPhoto,
            status: req.user.role === 'supervisor' ? 'pending' : 'verified',
            isActive: req.user.role === 'supervisor' ? false : true,
            allowedCreationScope: role === 'supervisor' ? (allowedCreationScope || 'employee_only') : undefined,
            createdBy: req.user._id,
            state: state || 'Delhi',
            city: city || 'Delhi',
            address: address || ''
        });

        const populated = await Employee.findById(employee._id).populate('userId').populate('managedBy');
        res.status(201).json({
            message: `${role || 'Staff'} created successfully`,
            employee: populated,
            credentials: {
                email,
                password: password || '123456'
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Delete employee
// @route   DELETE /api/admin/employees/:id
// @access  Private/Admin
async function deleteEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Delete linked User record if exists
        if (employee.userId) {
            await User.findByIdAndDelete(employee.userId);
        }

        await Employee.findByIdAndDelete(req.params.id);
        res.json({ message: 'Employee and user account removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Update employee
// @route   PUT /api/admin/employees/:id
// @access  Private/Admin
async function updateEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const { name, email, mobile, registrationCommission, isActive, panCard, aadharCard, panCardPhoto, aadharCardPhoto, status, state, city, address, password, allowedCreationScope } = req.body;

        employee.name = name || employee.name;
        employee.email = email || employee.email;
        employee.mobile = mobile || employee.mobile;
        employee.registrationCommission = registrationCommission !== undefined ? registrationCommission : employee.registrationCommission;
        employee.isActive = isActive !== undefined ? isActive : employee.isActive;
        employee.panCard = panCard || employee.panCard;
        employee.aadharCard = aadharCard || employee.aadharCard;
        employee.panCardPhoto = panCardPhoto || employee.panCardPhoto;
        employee.aadharCardPhoto = aadharCardPhoto || employee.aadharCardPhoto;
        employee.status = status || employee.status;
        employee.state = state !== undefined ? state : employee.state;
        employee.city = city !== undefined ? city : employee.city;
        employee.address = address !== undefined ? address : employee.address;
        if (allowedCreationScope !== undefined) {
            employee.allowedCreationScope = allowedCreationScope;
        }

        const updated = await employee.save();

        // Also update linked User account
        if (employee.userId) {
            const user = await User.findById(employee.userId);
            if (user) {
                user.name = name || user.name;
                user.email = email || user.email;
                user.mobile = mobile || user.mobile;
                user.state = state !== undefined ? state : user.state;
                user.city = city !== undefined ? city : user.city;
                user.address = address !== undefined ? address : user.address;
                if (password && password !== "********") {
                    user.password = password;
                    user.plainPassword = password;
                }
                await user.save();
            }
        }
        const populated = await Employee.findById(updated._id).populate('userId').populate('managedBy');
        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Verify employee
// @route   PUT /api/admin/employees/:id/verify
// @access  Private/Admin
async function verifyEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        employee.status = 'verified';
        employee.isActive = true; // Ensure they are active when verified

        await employee.save();

        // Log Action
        await AuditLog.create({
            actionType: "VERIFY",
            entityType: "EMPLOYEE",
            entityId: employee._id,
            entityName: employee.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'verified' }
        });

        res.json({ success: true, message: 'Employee verified successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Reject employee
// @route   PUT /api/admin/employees/:id/reject
// @access  Private/Admin
async function rejectEmployee(req, res) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        employee.status = 'rejected';

        await employee.save();

        // Log Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "EMPLOYEE",
            entityId: employee._id,
            entityName: employee.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected' }
        });

        res.json({ success: true, message: 'Employee verification rejected' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const deleteEmergencyAlert = async (req, res) => {
    try {
        const EmergencyAlert = require('../models/EmergencyAlert');
        await EmergencyAlert.findByIdAndDelete(req.params.id);
        res.json({ message: 'Emergency alert removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ... Super Admin Methods ...

const getAllAdmins = async (req, res) => {
    try {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('-password').sort({ createdAt: -1 });
        res.json(admins);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createAdmin = async (req, res) => {
    try {
        const { name, email, mobile, password, permissions, city, state, kycAccess, kycLimit, kycBonusPerVerification } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: 'User already exists with this email' });

        const admin = await User.create({
            name,
            email,
            mobile,
            password,
            role: 'admin',
            permissions: permissions || [],
            city: city || 'Delhi',
            state: state || 'Delhi',
            kycAccess: kycAccess || false,
            kycLimit: kycLimit || 0,
            kycBonusPerVerification: kycBonusPerVerification || 0
        });

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions,
                kycAccess: admin.kycAccess,
                kycLimit: admin.kycLimit,
                kycBonusPerVerification: admin.kycBonusPerVerification
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAdminPermissions = async (req, res) => {
    try {
        const { permissions } = req.body;
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        admin.permissions = permissions;
        await admin.save();

        res.json({ message: 'Permissions updated successfully', permissions: admin.permissions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAdmin = async (req, res) => {
    try {
        const { name, email, mobile, password, permissions, kycAccess, kycLimit, kycBonusPerVerification } = req.body;
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        admin.name = name || admin.name;
        admin.email = email || admin.email;
        admin.mobile = mobile || admin.mobile;
        admin.permissions = permissions || admin.permissions;

        if (kycAccess !== undefined) admin.kycAccess = kycAccess;
        if (kycLimit !== undefined) admin.kycLimit = kycLimit;
        if (kycBonusPerVerification !== undefined) admin.kycBonusPerVerification = kycBonusPerVerification;

        if (password) {
            admin.password = password;
        }

        await admin.save();
        res.json({ message: 'Admin updated successfully', admin });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAllSewaks = async (req, res) => {
    try {
        let query = { providerCategory: 'sewak' };
        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (supervisorEmp) {
                const employees = await Employee.find({ 
                    $or: [
                        { managedBy: supervisorEmp._id },
                        { supervisorCode: supervisorEmp.ownCode },
                        { createdBy: req.user._id }
                    ]
                });
                const employeeCodes = employees.map(emp => emp.ownCode).filter(Boolean);
                const teamCodes = [supervisorEmp.ownCode, ...employeeCodes].filter(Boolean);
                query.$or = [
                    { referredBy: { $in: teamCodes } },
                    { onboardedByStaff: { $in: teamCodes } }
                ];
            } else {
                return res.json([]);
            }
        }
        const sewaks = await Provider.find(query).select('-password').sort({ createdAt: -1 });
        res.json(sewaks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSewakById = async (req, res) => {
    try {
        const sewak = await Provider.findById(req.params.id).select('-password');
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });
        res.json(sewak);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const createSewak = async (req, res) => {
    try {
        const { ownerName, mobile, password, email, address, city, state, businessType, latitude, longitude, bankDetails } = req.body;

        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
        }

        if (bankDetails && bankDetails.ifscCode) {
            try {
                const response = await axios.get(`https://ifsc.razorpay.com/${bankDetails.ifscCode}`);
                if (!response.data || !response.data.BANK) {
                    return res.status(400).json({ message: 'Invalid IFSC Code' });
                }
                bankDetails.bankName = response.data.BANK;
            } catch (error) {
                return res.status(400).json({ message: 'Invalid IFSC Code or unable to verify' });
            }
        }

        const providerExists = await Provider.findOne({ mobile });
        if (providerExists) {
            return res.status(400).json({ message: 'Mobile number already registered as a provider' });
        }

        // Generate a vendor code for Sewak
        const count = await Provider.countDocuments();
        const vendorCode = `RSSEW${String(count + 1).padStart(5, '0')}`;

        // Find Category to set vendorType
        const category = await Category.findOne({ name: businessType });

        const sewak = await Provider.create({
            ownerName,
            shopName: `${ownerName} (Sewak)`,
            mobile,
            password,
            email,
            address,
            city,
            state,
            bankDetails: bankDetails || {},
            location: {
                type: 'Point',
                coordinates: [Number(longitude) || 0, Number(latitude) || 0]
            },
            businessType: businessType || 'Internal Service',
            vendorType: category?._id || null,
            vendorCode,
            status: 'pending', // Verification REQUIRED
            providerCategory: 'sewak',
            kycVerified: false,
            commissionRate: 100, // 100% to Admin
            isOnline: false, // Wait until verified
            documents: [] // Documents will be uploaded by Sewak
        });

        // Auto-assign category services to the new Sewak
        if (category && category.services && category.services.length > 0) {
            try {
                const masterServicesData = category.services.map(svc => ({
                    providerId: sewak._id,
                    name: svc.name,
                    description: svc.description,
                    category: category.name,
                    price: svc.basePrice || 299,
                    visible: true
                }));
                const createdServices = await Service.insertMany(masterServicesData);

                // Auto-assign combos
                if (category.combos && category.combos.length > 0) {
                    const comboDocs = category.combos.map(combo => {
                        // Find service IDs for this combo based on names
                        const serviceIds = createdServices
                            .filter(s => combo.services.includes(s.name))
                            .map(s => s._id);

                        return {
                            providerId: sewak._id,
                            name: combo.name,
                            description: combo.description,
                            services: serviceIds,
                            price: combo.sewakPrice || 0,
                            image: combo.image,
                            isActive: true
                        };
                    });
                    await Combo.insertMany(comboDocs);
                }
            } catch (serviceError) {
                console.error("Failed to auto-assign services/combos to Sewak:", serviceError);
            }
        }

        res.status(201).json(sewak);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSewak = async (req, res) => {
    try {
        const { ownerName, mobile, password, email, address, city, state, businessType, bankDetails } = req.body;

        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        if (mobile && mobile !== sewak.mobile) {
            if (!/^\d{10}$/.test(mobile)) {
                return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
            }
            const providerExists = await Provider.findOne({ mobile });
            if (providerExists) return res.status(400).json({ message: 'Mobile number already registered as a provider' });
            sewak.mobile = mobile;
        }

        if (ownerName) {
            sewak.ownerName = ownerName;
            sewak.shopName = `${ownerName} (Sewak)`;
        }
        if (email) sewak.email = email;
        if (address) sewak.address = address;
        if (city) sewak.city = city;
        if (state) sewak.state = state;
        if (businessType) {
            sewak.businessType = businessType;
            const category = await Category.findOne({ name: businessType });
            if (category) sewak.vendorType = category._id;
        }
        if (bankDetails) {
            if (bankDetails.ifscCode) {
                try {
                    const response = await axios.get(`https://ifsc.razorpay.com/${bankDetails.ifscCode}`);
                    if (!response.data || !response.data.BANK) {
                        return res.status(400).json({ message: 'Invalid IFSC Code' });
                    }
                    bankDetails.bankName = response.data.BANK;
                } catch (error) {
                    return res.status(400).json({ message: 'Invalid IFSC Code or unable to verify' });
                }
            }
            sewak.bankDetails = bankDetails;
        }

        // Only update password if provided
        if (password) {
            console.log("Updating password to:", password);
            sewak.password = password;
        }

        console.log("Before save hash:", sewak.password);
        await sewak.save();
        console.log("After save hash:", sewak.password);
        res.json({ message: 'Sewak updated successfully', sewak });
    } catch (error) {
        console.log("Error in updateSewak:", error);
        res.status(500).json({ message: error.message });
    }
};

const verifySuperAdminPin = async (req, res) => {
    try {
        const { pin } = req.body;
        const savedPin = await Setting.findOne({ key: 'SUPER_ADMIN_PIN' });
        const actualPin = savedPin ? savedPin.value : '1234';

        if (pin === actualPin) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Invalid PIN' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSuperAdminPin = async (req, res) => {
    try {
        const { pin } = req.body;
        await Setting.findOneAndUpdate(
            { key: 'SUPER_ADMIN_PIN' },
            { value: pin, updatedAt: Date.now() },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'PIN updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAdmin = async (req, res) => {
    try {
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        if (admin.role === 'superadmin') return res.status(400).json({ message: 'Super Admin cannot be deleted' });

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProviderPlan = async (req, res) => {
    try {
        const { planType } = req.body;
        const provider = await Provider.findByIdAndUpdate(
            req.params.id,
            { planType },
            { new: true }
        );
        if (!provider) return res.status(404).json({ message: 'Provider not found' });
        res.json(provider);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteProvider = async (req, res) => {
    try {
        const provider = await Provider.findById(req.params.id);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        await Provider.findByIdAndDelete(req.params.id);
        // Clean up services and combos
        await Service.deleteMany({ providerId: req.params.id });
        await Combo.deleteMany({ providerId: req.params.id });

        res.json({ message: 'Provider and associated data removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPendingSewaks = async (req, res) => {
    try {
        let query = {
            providerCategory: 'sewak',
            kycVerified: false,
            $or: [
                { kycSubmitted: true },
                { status: 'pending', kycStatus: { $in: ['draft', 'submitted', 'under_review', 'partially_approved'] } }
            ]
        };

        if (req.user.role === 'supervisor') {
            const supervisorEmp = await Employee.findOne({ userId: req.user._id });
            if (supervisorEmp) {
                const employees = await Employee.find({ 
                    $or: [
                        { managedBy: supervisorEmp._id },
                        { supervisorCode: supervisorEmp.ownCode },
                        { createdBy: req.user._id }
                    ]
                });
                const employeeCodes = employees.map(emp => emp.ownCode).filter(Boolean);
                const teamCodes = [supervisorEmp.ownCode, ...employeeCodes].filter(Boolean);
                query = {
                    ...query,
                    $and: [
                        {
                            $or: [
                                { referredBy: { $in: teamCodes } },
                                { onboardedByStaff: { $in: teamCodes } }
                            ]
                        }
                    ]
                };
            } else {
                return res.json([]);
            }
        }

        const sewaks = await Provider.find(query).sort({ updatedAt: -1 });
        res.json(sewaks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifySewak = async (req, res) => {
    try {
        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        sewak.kycVerified = true;
        sewak.kycStatus = 'verified';
        sewak.status = 'verified';
        sewak.isOnline = true;
        // Verify all documents
        if (sewak.documents) {
            sewak.documents.forEach(doc => {
                doc.status = 'verified';
                doc.reviewedAt = new Date();
            });
        }

        await sewak.save();

        // Notify Provider
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(sewak._id, 'provider', {
                title: 'KYC Approved',
                body: 'Congratulations! Your identity verification is complete. Your account is now active to receive bookings.',
                data: { type: 'kyc', id: sewak._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on verifySewak:', err.message);
        }

        // Calculate Bonus if applicable
        let bonusEarned = 0;
        if (req.user && req.user.kycAccess) {
            const totalKYCs = await AuditLog.countDocuments({
                verifiedBy: req.user._id,
                actionType: "VERIFY",
                entityType: "SEWAK"
            });

            if (totalKYCs >= req.user.kycLimit) {
                bonusEarned = req.user.kycBonusPerVerification;
            }
        }

        // Log Verification Action
        await AuditLog.create({
            actionType: "VERIFY",
            entityType: "SEWAK",
            entityId: sewak._id,
            entityName: sewak.ownerName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            bonusEarned: bonusEarned,
            details: { status: 'verified', bonusEarned }
        });

        res.json({ success: true, message: 'Sewak verified successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const rejectSewak = async (req, res) => {
    try {
        const { rejectionReason = 'KYC documents invalid' } = req.body;
        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        sewak.kycVerified = false;
        sewak.kycStatus = 'rejected';
        sewak.status = 'rejected';
        // Keep kycSubmitted as-is so the sewak remains visible in the admin panel for audit
        // Reject all documents
        if (sewak.documents) {
            sewak.documents.forEach(doc => {
                if (doc.status !== 'verified') {
                    doc.status = 'rejected';
                    doc.rejectionReason = rejectionReason;
                    doc.reviewedAt = new Date();
                }
            });
        }

        await sewak.save();

        // Notify Provider
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(sewak._id, 'provider', {
                title: 'KYC Rejected',
                body: `Your KYC application was rejected. Reason: ${rejectionReason}`,
                data: { type: 'kyc', id: sewak._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on rejectSewak:', err.message);
        }

        // Log Rejection Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "SEWAK",
            entityId: sewak._id,
            entityName: sewak.ownerName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected', rejectionReason }
        });

        res.json({ success: true, message: 'Sewak KYC rejected' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifySewakDocument = async (req, res) => {
    try {
        const { id, docId } = req.params;
        const { status, rejectionReason, adminNotes } = req.body;

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status. Must be verified or rejected.' });
        }

        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({ message: 'Rejection reason is required.' });
        }

        const sewak = await Provider.findById(id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        let docIndex = sewak.documents.findIndex(d => d.id === docId);

        if (docIndex === -1) {
            // Document doesn't exist yet (admin-created sewak with no uploads)
            // Create a placeholder entry with the given status so rejection is recorded
            sewak.documents.push({
                id: docId,
                status,
                reviewedAt: new Date(),
                rejectionReason: status === 'rejected' ? rejectionReason : null,
                adminNotes: adminNotes || null,
            });
        } else {
            // Update existing document fields
            sewak.documents[docIndex].status = status;
            sewak.documents[docIndex].reviewedAt = new Date();
            if (status === 'rejected') {
                sewak.documents[docIndex].rejectionReason = rejectionReason;
            } else {
                sewak.documents[docIndex].rejectionReason = null;
            }
            if (adminNotes !== undefined) {
                sewak.documents[docIndex].adminNotes = adminNotes;
            }
        }

        // Mark modified so mongoose saves nested updates
        sewak.markModified('documents');

        const { sendNotificationToUser } = require('../config/notificationService');

        // Notify the Sewak about individual document status
        try {
            let title = '';
            let body = '';

            if (docId === 'live_video') {
                title = status === 'verified' ? 'Live Video Approved' : 'Live Video Rejected';
                body = status === 'verified'
                    ? 'Your Live Video verification has been approved.'
                    : `Your Live Video verification was rejected. Reason: ${rejectionReason}`;
            } else {
                const docLabel = docId.toUpperCase().replace('_', ' ');
                title = status === 'verified' ? `${docLabel} Approved` : `${docLabel} Rejected`;
                body = status === 'verified'
                    ? `Your ${docLabel} has been approved by the admin.`
                    : `Your ${docLabel} was rejected. Reason: ${rejectionReason}`;
            }

            await sendNotificationToUser(sewak._id, 'provider', {
                title,
                body,
                data: { type: 'kyc', id: sewak._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on doc update:', err.message);
        }

        if (status === 'rejected') {
            sewak.kycStatus = 'rejected';
            sewak.status = 'rejected';
            sewak.kycVerified = false;
            // Keep kycSubmitted as-is so the sewak remains visible in the admin panel for audit

            // Notify Sewak: Overall KYC rejected
            try {
                await sendNotificationToUser(sewak._id, 'provider', {
                    title: 'KYC Rejected',
                    body: `Your KYC application was rejected. Please review and update the rejected items.`,
                    data: { type: 'kyc', id: sewak._id.toString() }
                });
            } catch (err) {
                console.error('Failed to notify provider on overall kyc reject:', err.message);
            }
        } else {
            // Check if ALL required documents and live video are approved
            const requiredDocs = ['aadhaar', 'pan', 'live_video'];
            const allApproved = requiredDocs.every(reqId => {
                const doc = sewak.documents.find(d => d.id === reqId);
                return doc && doc.status === 'verified';
            });

            if (allApproved) {
                sewak.kycStatus = 'verified';
                sewak.status = 'verified';
                sewak.kycVerified = true;
                sewak.isOnline = true;

                // Notify Sewak: Overall KYC approved
                try {
                    await sendNotificationToUser(sewak._id, 'provider', {
                        title: 'KYC Approved',
                        body: 'Congratulations! Your identity verification is complete. Your account is now active to receive bookings.',
                        data: { type: 'kyc', id: sewak._id.toString() }
                    });
                } catch (err) {
                    console.error('Failed to notify provider on overall kyc verify:', err.message);
                }
            } else {
                sewak.kycStatus = 'partially_approved';
            }
        }

        await sewak.save();

        // Audit Logging
        try {
            await AuditLog.create({
                actionType: status === 'verified' ? "APPROVE_DOCUMENT" : "REJECT_DOCUMENT",
                entityType: "SEWAK",
                entityId: sewak._id,
                entityName: sewak.ownerName,
                verifiedBy: req.user._id,
                verifiedByName: req.user.name,
                verifiedByRole: req.user.role,
                details: { docId, status }
            });
        } catch (auditErr) {
            console.error('Audit log failed:', auditErr.message);
        }

        res.json({
            success: true,
            message: `Document ${docId} status updated to ${status}`,
            kycStatus: sewak.kycStatus,
            providerStatus: sewak.status
        });

    } catch (error) {
        console.error('Verify Sewak Document Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all subscription plans
// @route   GET /api/admin/subscriptions
// @access  Private/Admin
const getAdminSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find().populate('category', 'name');
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create subscription plan
// @route   POST /api/admin/subscriptions
// @access  Private/Admin
const createSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        res.status(201).json(plan);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update subscription plan
// @route   PUT /api/admin/subscriptions/:id
// @access  Private/Admin
const updateSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json(plan);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete subscription plan
// @route   DELETE /api/admin/subscriptions/:id
// @access  Private/Admin
const deleteSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        res.json({ message: 'Plan deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Audit/Verification Logs
// @route   GET /api/admin/audit-logs
// @access  Private/SuperAdmin
const getAuditLogs = async (req, res) => {
    try {
        const { adminId, entityType, startDate, endDate, search, page = 1, limit = 20 } = req.query;
        let query = {};

        if (adminId) query.verifiedBy = adminId;
        if (entityType) query.entityType = entityType;

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                { entityName: { $regex: search, $options: 'i' } },
                { verifiedByName: { $regex: search, $options: 'i' } }
            ];
        }

        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('verifiedBy', 'name email role');

        const total = await AuditLog.countDocuments(query);

        res.json({
            logs,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Night Charge Settings
// @route   GET /api/admin/night-charge
// @access  Private/Admin
const getNightChargeSettings = async (req, res) => {
    try {
        const globalSetting = await Setting.findOne({ key: 'night_charge_config' });
        const categories = await Category.find({}, 'name hasNightCharge nightChargePercent');

        res.json({
            global: globalSetting ? globalSetting.value : { enabled: false, defaultPercent: 10, startTime: '21:00', endTime: '06:00' },
            categories
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Global Night Charge Settings
// @route   POST /api/admin/night-charge/global
// @access  Private/Admin
const updateGlobalNightCharge = async (req, res) => {
    try {
        const { enabled, defaultPercent, startTime, endTime } = req.body;

        let setting = await Setting.findOne({ key: 'night_charge_config' });
        if (setting) {
            setting.value = { enabled, defaultPercent, startTime, endTime };
            setting.updatedAt = Date.now();
            await setting.save();
        } else {
            setting = await Setting.create({
                key: 'night_charge_config',
                value: { enabled, defaultPercent, startTime, endTime }
            });
        }

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Category Night Charge
// @route   PUT /api/admin/night-charge/category/:id
// @access  Private/Admin
const updateCategoryNightCharge = async (req, res) => {
    try {
        const { hasNightCharge, nightChargePercent } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        category.hasNightCharge = hasNightCharge;
        category.nightChargePercent = nightChargePercent;
        await category.save();

        res.json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Apply Global Night Charge to all categories
// @route   POST /api/admin/night-charge/apply-all
// @access  Private/Admin
const applyGlobalNightChargeToAll = async (req, res) => {
    try {
        const globalSetting = await Setting.findOne({ key: 'night_charge_config' });
        if (!globalSetting) {
            return res.status(404).json({ message: 'Global settings not found' });
        }

        const { defaultPercent, enabled } = globalSetting.value;

        await Category.updateMany({}, {
            hasNightCharge: enabled,
            nightChargePercent: defaultPercent
        });

        res.json({ message: 'Applied to all categories successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Admin KYC Performance (Super Admin)
// @route   GET /api/admin/kyc-performance
// @access  Private/SuperAdmin
const getAdminKycPerformance = async (req, res) => {
    try {
        const performance = await AuditLog.aggregate([
            {
                $match: {
                    actionType: "VERIFY",
                    entityType: { $in: ["SEWAK", "VENDOR"] }
                }
            },
            {
                $group: {
                    _id: "$verifiedBy",
                    totalSewakVerified: {
                        $sum: { $cond: [{ $eq: ["$entityType", "SEWAK"] }, 1, 0] }
                    },
                    totalVendorVerified: {
                        $sum: { $cond: [{ $eq: ["$entityType", "VENDOR"] }, 1, 0] }
                    },
                    totalVerified: { $sum: 1 },
                    totalBonus: { $sum: "$bonusEarned" },
                    adminName: { $first: "$verifiedByName" }
                }
            }
        ]);

        // Merge with Admin details to show limit etc.
        const admins = await User.find({ role: 'admin' }, 'name kycLimit kycBonusPerVerification kycAccess');

        const report = admins.map(admin => {
            const perf = performance.find(p => p._id && p._id.toString() === admin._id.toString()) || { totalVerified: 0, totalBonus: 0, totalSewakVerified: 0, totalVendorVerified: 0 };
            return {
                adminId: admin._id,
                name: admin.name,
                kycAccess: admin.kycAccess,
                kycLimit: admin.kycLimit,
                bonusPerKyc: admin.kycBonusPerVerification,
                totalVerified: perf.totalVerified || 0,
                totalSewakVerified: perf.totalSewakVerified || 0,
                totalVendorVerified: perf.totalVendorVerified || 0,
                totalBonus: perf.totalBonus || 0,
                remainingForBonus: Math.max(0, admin.kycLimit - (perf.totalVerified || 0))
            };
        });

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Sewak Incentives Report (Super Admin)
// @route   GET /api/admin/sewak-incentives
// @access  Private/SuperAdmin
const getSewakIncentives = async (req, res) => {
    try {
        const { date, sewakId } = req.query;

        // Get Global Settings
        const settings = await Setting.find({ key: { $in: ['DAILY_BOOKING_THRESHOLD', 'BONUS_PER_EXTRA_BOOKING'] } });
        const threshold = Number(settings.find(s => s.key === 'DAILY_BOOKING_THRESHOLD')?.value || 5);
        const bonusAmount = Number(settings.find(s => s.key === 'BONUS_PER_EXTRA_BOOKING')?.value || 50);

        // Define date range
        const queryDate = date || new Date().toISOString().split('T')[0];
        const startOfDay = new Date(queryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(queryDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch Sewaks
        const sewakQuery = { providerCategory: 'sewak' };
        if (sewakId) sewakQuery._id = sewakId;
        const sewaks = await Provider.find(sewakQuery).select('ownerName mobile shopName');

        // Calculate counts for each sewak
        const logs = await Promise.all(sewaks.map(async (sewak) => {
            const dailyBookingCount = await Booking.countDocuments({
                providerId: sewak._id,
                status: 'completed',
                updatedAt: { $gte: startOfDay, $lte: endOfDay }
            });

            const incentiveLog = await SewakIncentiveLog.findOne({
                sewakId: sewak._id,
                date: queryDate
            });

            return {
                _id: incentiveLog?._id || sewak._id, // Fallback to sewak ID if no log
                sewakId: sewak,
                dailyBookingCount,
                bonusEarned: incentiveLog ? incentiveLog.bonusEarned : 0,
                earned: dailyBookingCount > threshold,
                date: queryDate
            };
        }));

        // Sort by count descending
        logs.sort((a, b) => b.dailyBookingCount - a.dailyBookingCount);

        res.json({
            logs,
            config: { threshold, bonusAmount }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Sewak Incentive Settings
// @route   POST /api/admin/sewak-incentive-settings
// @access  Private/SuperAdmin
const updateSewakIncentiveSettings = async (req, res) => {
    try {
        const { threshold, bonusAmount } = req.body;

        await Promise.all([
            Setting.findOneAndUpdate({ key: 'DAILY_BOOKING_THRESHOLD' }, { value: threshold, updatedAt: Date.now() }, { upsert: true }),
            Setting.findOneAndUpdate({ key: 'BONUS_PER_EXTRA_BOOKING' }, { value: bonusAmount, updatedAt: Date.now() }, { upsert: true })
        ]);

        res.json({ message: 'Sewak incentive settings updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all combos for admin
// @route   GET /api/admin/combos
// @access  Private/Admin
const getCombos = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
        const combos = await Combo.find(query)
            .populate('providerId', 'shopName ownerName mobile city vendorCode')
            .populate('services')
            .sort({ createdAt: -1 });
        res.json(combos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify/Approve a combo
// @route   PUT /api/admin/combos/:id/verify
// @access  Private/Admin
const verifyCombo = async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.id);
        if (!combo) {
            return res.status(404).json({ message: 'Combo not found' });
        }
        combo.status = 'approved';
        combo.isActive = true; // Make it active on approval
        await combo.save();

        // Log Action
        await AuditLog.create({
            actionType: "VERIFY",
            entityType: "COMBO",
            entityId: combo._id,
            entityName: combo.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'approved' }
        });

        res.json({ success: true, message: 'Combo approved' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject a combo
// @route   PUT /api/admin/combos/:id/reject
// @access  Private/Admin
const rejectCombo = async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.id);
        if (!combo) {
            return res.status(404).json({ message: 'Combo not found' });
        }
        combo.status = 'rejected';
        await combo.save();

        // Log Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "COMBO",
            entityId: combo._id,
            entityName: combo.name,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected' }
        });

        res.json({ success: true, message: 'Combo rejected' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Cash Limits Config
// @route   GET /api/admin/settings/cash-limits
// @access  Private/Admin
const getCashLimitsConfig = async (req, res) => {
    try {
        let configSetting = await Setting.findOne({ key: 'cash_limits_config' });

        let config = {
            defaultLimit: 1500,
            categoryLimits: [],
            serviceLimits: []
        };

        if (configSetting) {
            config = { ...config, ...configSetting.value };
        }

        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Cash Limits Config
// @route   PUT /api/admin/settings/cash-limits
// @access  Private/Admin
const updateCashLimitsConfig = async (req, res) => {
    try {
        const { defaultLimit, categoryLimits, serviceLimits } = req.body;

        const newConfig = {
            defaultLimit: Number(defaultLimit) || 1500,
            categoryLimits: Array.isArray(categoryLimits) ? categoryLimits : [],
            serviceLimits: Array.isArray(serviceLimits) ? serviceLimits : []
        };

        await Setting.findOneAndUpdate(
            { key: 'cash_limits_config' },
            { value: newConfig, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        res.json({ message: 'Cash limits updated successfully', config: newConfig });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Global search across users, providers, sewaks, bookings
// @route   GET /api/admin/search?q=...
// @access  Private/Admin
const adminGlobalSearch = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
        return res.json({ users: [], providers: [], sewaks: [], bookings: [] });
    }

    const regex = { $regex: q.trim(), $options: 'i' };
    try {
        const [users, providers, sewaks, bookings] = await Promise.all([
            User.find({ $or: [{ name: regex }, { email: regex }, { mobile: regex }] })
                .select('name email mobile').limit(5).lean(),

            Provider.find({
                providerCategory: { $ne: 'sewak' },
                $or: [{ shopName: regex }, { ownerName: regex }, { mobile: regex }, { vendorCode: regex }]
            }).select('shopName ownerName mobile vendorCode status').limit(5).lean(),

            Provider.find({
                providerCategory: 'sewak',
                $or: [{ ownerName: regex }, { mobile: regex }, { vendorCode: regex }]
            }).select('ownerName mobile vendorCode kycStatus status').limit(5).lean(),

            Booking.find({ $or: [{ bookingId: regex }, { serviceName: regex }] })
                .select('bookingId serviceName status amount createdAt').limit(5).lean(),
        ]);

        res.json({ users, providers, sewaks, bookings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get admin notifications (recent actions + pending items)
// @route   GET /api/admin/notifications
// @access  Private/Admin
const getAdminNotifications = async (req, res) => {
    try {
        const [
            recentLogs,
            pendingKyc,
            pendingSewaks,
            pendingEmployees,
            pendingBookings,
        ] = await Promise.all([
            AuditLog.find().sort({ timestamp: -1 }).limit(5).lean(),
            Provider.countDocuments({ providerCategory: { $ne: 'sewak' }, kycVerified: false, kycSubmitted: true }),
            Provider.countDocuments({ providerCategory: 'sewak', kycVerified: false, $or: [{ kycSubmitted: true }, { status: 'pending' }] }),
            // employees pending verification – use Provider model employees
            Provider.countDocuments({ providerCategory: { $ne: 'sewak' }, status: 'pending' }),
            Booking.countDocuments({ status: 'pending' }),
        ]);

        const notifications = [];

        if (pendingKyc > 0) {
            notifications.push({
                id: 'kyc-pending',
                type: 'kyc',
                title: `${pendingKyc} Provider KYC Pending`,
                message: 'Provider KYC applications awaiting review.',
                link: '/admin/kyc',
                time: new Date(),
            });
        }

        if (pendingSewaks > 0) {
            notifications.push({
                id: 'sewak-kyc-pending',
                type: 'kyc',
                title: `${pendingSewaks} Sewak KYC Pending`,
                message: 'Sewak verification applications awaiting review.',
                link: '/admin/verify-sewaks',
                time: new Date(),
            });
        }

        if (pendingBookings > 0) {
            notifications.push({
                id: 'bookings-pending',
                type: 'booking',
                title: `${pendingBookings} Pending Bookings`,
                message: 'Bookings awaiting provider assignment.',
                link: '/admin/bookings',
                time: new Date(),
            });
        }

        // Add recent audit activity
        recentLogs.forEach(log => {
            notifications.push({
                id: log._id.toString(),
                type: 'activity',
                title: `${log.actionType}: ${log.entityType}`,
                message: `${log.verifiedByName || 'Admin'} performed ${log.actionType} on ${log.entityName || log.entityType}`,
                link: '/admin/audit-logs',
                time: log.timestamp,
            });
        });

        // Sort newest first
        notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

        res.json({ notifications: notifications.slice(0, 15), counts: { pendingKyc, pendingSewaks, pendingBookings } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Distance Charge Settings
// @route   GET /api/admin/distance-charge
// @access  Private/Admin
const getDistanceChargeSettings = async (req, res) => {
    try {
        let setting = await Setting.findOne({ key: 'distance_charge_config' });
        if (!setting) {
            // Return default
            return res.json({
                enabled: true,
                baseDistance: 3,
                baseFee: 40,
                extraFeePerKm: 10,
                maximumDistance: null,
                maximumCharge: null,
                rounding: 'nearest',
                calculationMethod: 'haversine',
                fallbackCharge: 40
            });
        }
        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Distance Charge Settings
// @route   PUT /api/admin/distance-charge
// @access  Private/Admin
const updateDistanceChargeSettings = async (req, res) => {
    try {
        const {
            enabled,
            baseDistance,
            baseFee,
            extraFeePerKm,
            maximumDistance,
            maximumCharge,
            rounding,
            calculationMethod,
            fallbackCharge
        } = req.body;

        const updatedValue = {
            enabled: enabled !== undefined ? enabled : true,
            baseDistance: Number(baseDistance) || 3,
            baseFee: Number(baseFee) || 40,
            extraFeePerKm: Number(extraFeePerKm) || 10,
            maximumDistance: maximumDistance ? Number(maximumDistance) : null,
            maximumCharge: maximumCharge ? Number(maximumCharge) : null,
            rounding: rounding || 'nearest',
            calculationMethod: calculationMethod || 'haversine',
            fallbackCharge: fallbackCharge !== undefined ? Number(fallbackCharge) : 40,
            categoryOverrides: req.body.categoryOverrides || {}
        };

        const setting = await Setting.findOneAndUpdate(
            { key: 'distance_charge_config' },
            { value: updatedValue, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        // Log Action
        await AuditLog.create({
            actionType: "UPDATE_SETTINGS",
            entityType: "DISTANCE_CHARGE",
            entityId: setting._id,
            entityName: "Distance Charge Configuration",
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'update_distance_charge', newValue: updatedValue }
        });

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Get Service Radius Limits (admin-configurable)
// @route   GET /api/admin/settings/service-radius
// @access  Private/Admin
const getServiceRadiusLimits = async (req, res) => {
    try {
        const setting = await Setting.findOne({ key: 'provider_service_radius_limits' });
        if (!setting) {
            return res.json({ minimumRadius: 1, maximumRadius: 50 });
        }
        return res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Service Radius Limits
// @route   PUT /api/admin/settings/service-radius
// @access  Private/Admin
const updateServiceRadiusLimits = async (req, res) => {
    try {
        const { minimumRadius, maximumRadius } = req.body;

        const min = Number(minimumRadius);
        const max = Number(maximumRadius);

        if (isNaN(min) || isNaN(max)) {
            return res.status(400).json({ message: 'minimumRadius and maximumRadius must be valid numbers.' });
        }
        if (min <= 0) {
            return res.status(400).json({ message: 'minimumRadius must be greater than 0.' });
        }
        if (max <= min) {
            return res.status(400).json({ message: 'maximumRadius must be greater than minimumRadius.' });
        }

        const updatedValue = { minimumRadius: min, maximumRadius: max };

        const setting = await Setting.findOneAndUpdate(
            { key: 'provider_service_radius_limits' },
            { value: updatedValue, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        // Audit log
        await AuditLog.create({
            actionType: 'UPDATE_SETTINGS',
            entityType: 'SERVICE_RADIUS_LIMITS',
            entityId: setting._id,
            entityName: 'Provider Service Radius Limits',
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { action: 'update_service_radius_limits', newValue: updatedValue }
        });

        res.json(setting.value);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProviders,
    getProviderReports,
    resolveProviderReport,
    updateProviderStatus,
    updateProviderPlan,
    getAdminStats,
    getBookings,
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getUsers,
    toggleUserStatus,
    getBanners,
    addBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    getEmergencyData,
    broadcastEmergency,
    get99CardData,
    getFeedbackData,
    getActivityLogs,
    getSettings,
    updateSettings,
    updateAdminProfile,
    getPromotions,
    createPromotion,
    deletePromotion,
    getZones,
    addZone,
    deleteZone,
    getEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    verifyEmployee,
    rejectEmployee,
    deleteEmergencyAlert,
    getAllAdmins,
    createAdmin,
    updateAdminPermissions,
    verifySuperAdminPin,
    updateSuperAdminPin,
    deleteAdmin,
    updateAdmin,
    getAllSewaks,
    getSewakById,
    createSewak,
    updateSewak,
    getPendingSewaks,
    verifySewak,
    rejectSewak,
    verifySewakDocument,
    deleteProvider,
    getAdminSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    updateProviderCategory,
    getAuditLogs,
    getNightChargeSettings,
    updateGlobalNightCharge,
    updateCategoryNightCharge,
    applyGlobalNightChargeToAll,
    getAdminKycPerformance,
    getSewakIncentives,
    updateSewakIncentiveSettings,
    getCombos,
    verifyCombo,
    rejectCombo,
    getCashLimitsConfig,
    updateCashLimitsConfig,
    deleteUser,
    deleteBooking,
    adminGlobalSearch,
    getAdminNotifications,
    getDistanceChargeSettings,
    updateDistanceChargeSettings,
    getServiceRadiusLimits,
    updateServiceRadiusLimits,
};