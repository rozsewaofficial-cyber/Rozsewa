const Provider = require('../models/Provider');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Category = require('../models/Category');
const AuditLog = require('../models/AuditLog');
const SewakIncentiveLog = require('../models/SewakIncentiveLog');
// Trigger restart

// @desc    Get all providers for admin
// @route   GET /api/admin/providers
// @access  Private/Admin
const getProviders = async (req, res) => {
    try {
        const { status } = req.query;
        const query = status ? { status } : {};
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

        provider.providerCategory = req.body.providerCategory || provider.providerCategory;
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
        const query = status ? { status } : {};
        const bookings = await Booking.find(query)
            .populate('userId', 'name email mobile')
            .populate('providerId', 'shopName ownerName mobile')
            .sort({ createdAt: -1 });
        res.json(bookings);
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
                                    'pricing.basic': sub.sewakPriceBasic ?? sub.basePrice ?? 299,
                                    'pricing.standard': sub.sewakPriceStandard ?? 0,
                                    'pricing.premium': sub.sewakPricePremium ?? 0,
                                    'pricing.express': sub.sewakPriceExpress ?? 0
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
            query = { ...query, $or: [{ managedBy: req.user._id }, { createdBy: req.user._id }] };
        }
        
        const employees = await Employee.find(query).sort({ createdAt: -1 });
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Add new employee (Supervisor, Field Staff, WFH)
// @route   POST /api/admin/employees
// @access  Private/Admin
async function addEmployee(req, res) {
    try {
        const { name, email, mobile, password, role, supervisorCode, registrationCommission, city, state, panCard, aadharCard, panCardPhoto, aadharCardPhoto } = req.body;

        // Validation: Documents and numbers are required
        if (!panCard || !aadharCard || !panCardPhoto || !aadharCardPhoto) {
            return res.status(400).json({ message: 'PAN and Aadhaar numbers and photos are required' });
        }

        // 1. Hierarchy Validation and Restriction
        if (req.user.role === 'supervisor') {
            if (role !== 'employee' && role !== 'field_staff') {
                return res.status(403).json({ message: 'Supervisors can only create Employees or Field Staff' });
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

        if (req.user.role === 'supervisor') {
            managedBy = req.user._id;
            supervisorId = req.user._id;
        } else if (role === 'field_staff') {
            if (!supervisorCode) {
                return res.status(400).json({ message: 'Supervisor Code is mandatory for creating Field Staff' });
            }
            const supervisor = await Employee.findOne({ ownCode: supervisorCode, role: 'supervisor' });
            if (!supervisor) {
                return res.status(400).json({ message: 'Invalid Supervisor Code. No such supervisor found.' });
            }
            managedBy = supervisor.userId || supervisor._id;
            supervisorId = supervisor.userId || supervisor._id;
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
            role: role || 'employee',
            city: city || 'Delhi',
            state: state || 'Delhi',
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
            supervisorCode: role === 'field_staff' ? supervisorCode : undefined,
            managedBy,
            registrationCommission: registrationCommission || 50,
            panCard,
            aadharCard,
            panCardPhoto,
            aadharCardPhoto,
            status: req.user.role === 'supervisor' ? 'pending' : 'verified',
            isActive: req.user.role === 'supervisor' ? false : true,
            createdBy: req.user._id
        });

        res.status(201).json({
            message: `${role || 'Staff'} created successfully`,
            employee,
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

        const { name, email, mobile, registrationCommission, isActive, panCard, aadharCard, panCardPhoto, aadharCardPhoto, status } = req.body;

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

        const updated = await employee.save();
        res.json(updated);
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
        const sewaks = await Provider.find({ providerCategory: 'sewak' }).select('-password').sort({ createdAt: -1 });
        res.json(sewaks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const createSewak = async (req, res) => {
    try {
        const { ownerName, mobile, password, email, address, city, state, businessType, latitude, longitude, bankDetails } = req.body;

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
                    pricing: {
                        basic: svc.sewakPriceBasic || svc.basePrice || 299,
                        standard: svc.sewakPriceStandard || 0,
                        premium: svc.sewakPricePremium || 0,
                        express: svc.sewakPriceExpress || 0
                    },
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
        const sewaks = await Provider.find({
            providerCategory: 'sewak',
            kycVerified: false,
            documents: { $exists: true, $ne: [] }
        }).sort({ updatedAt: -1 });
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
        sewak.status = 'verified';
        sewak.isOnline = true;
        // Verify all documents
        if (sewak.documents) {
            sewak.documents.forEach(doc => {
                doc.status = 'verified';
            });
        }

        await sewak.save();

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
        const sewak = await Provider.findById(req.params.id);
        if (!sewak) return res.status(404).json({ message: 'Sewak not found' });

        sewak.kycVerified = false;
        sewak.status = 'rejected';
        // Reject all documents
        if (sewak.documents) {
            sewak.documents.forEach(doc => {
                doc.status = 'rejected';
            });
        }

        await sewak.save();

        // Log Rejection Action
        await AuditLog.create({
            actionType: "REJECT",
            entityType: "SEWAK",
            entityId: sewak._id,
            entityName: sewak.ownerName,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name,
            verifiedByRole: req.user.role,
            details: { status: 'rejected' }
        });

        res.json({ success: true, message: 'Sewak KYC rejected' });
    } catch (error) {
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
                    entityType: "SEWAK"
                }
            },
            {
                $group: {
                    _id: "$verifiedBy",
                    totalVerified: { $sum: 1 },
                    totalBonus: { $sum: "$bonusEarned" },
                    adminName: { $first: "$verifiedByName" }
                }
            }
        ]);

        // Merge with Admin details to show limit etc.
        const admins = await User.find({ role: 'admin' }, 'name kycLimit kycBonusPerVerification kycAccess');

        const report = admins.map(admin => {
            const perf = performance.find(p => p._id.toString() === admin._id.toString()) || { totalVerified: 0, totalBonus: 0 };
            return {
                adminId: admin._id,
                name: admin.name,
                kycAccess: admin.kycAccess,
                kycLimit: admin.kycLimit,
                bonusPerKyc: admin.kycBonusPerVerification,
                totalVerified: perf.totalVerified,
                totalBonus: perf.totalBonus,
                remainingForBonus: Math.max(0, admin.kycLimit - perf.totalVerified)
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
        const query = {};
        if (date) query.date = date;
        if (sewakId) query.sewakId = sewakId;

        const logs = await SewakIncentiveLog.find(query)
            .populate('sewakId', 'ownerName mobile shopName')
            .sort({ createdAt: -1 });

        // Get Global Settings for context
        const settings = await Setting.find({ key: { $in: ['DAILY_BOOKING_THRESHOLD', 'BONUS_PER_EXTRA_BOOKING'] } });
        const threshold = Number(settings.find(s => s.key === 'DAILY_BOOKING_THRESHOLD')?.value || 5);
        const bonusAmount = Number(settings.find(s => s.key === 'BONUS_PER_EXTRA_BOOKING')?.value || 50);

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

module.exports = {
    getProviders,
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
    deleteBanner,
    updateBanner,
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
    createSewak,
    getPendingSewaks,
    verifySewak,
    rejectSewak,
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
    updateSewakIncentiveSettings
};
