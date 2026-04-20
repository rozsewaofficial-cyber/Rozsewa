const Provider = require('../models/Provider');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');

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

const Category = require('../models/Category');

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

        Object.assign(category, req.body);
        const updated = await category.save();
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
        const totalSales = await Provider.countDocuments();
        const activeSubscribers = await Provider.countDocuments({ status: 'verified' });
        const recentActivations = await Provider.find()
            .select('ownerName shopName joinedDate referralCode employeeCode commissionFreeBookings')
            .sort({ joinedDate: -1 })
            .limit(10);

        res.json({
            totalSales,
            activeSubscribers,
            totalRevenue: totalSales * 99,
            recentActivations
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
        const employees = await Employee.find().sort({ createdAt: -1 });
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Add new employee
// @route   POST /api/admin/employees
// @access  Private/Admin
async function addEmployee(req, res) {
    try {
        const { name, email, mobile, registrationCommission } = req.body;

        // Generate Employee ID (e.g., EMP1001)
        const count = await Employee.countDocuments();
        const employeeId = `EMP${1000 + count + 1}`;

        const employee = await Employee.create({
            name,
            email,
            mobile,
            employeeId,
            registrationCommission
        });
        res.status(201).json(employee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// @desc    Delete employee
// @route   DELETE /api/admin/employees/:id
// @access  Private/Admin
async function deleteEmployee(req, res) {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        res.json({ message: 'Employee removed' });
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

        const { name, email, mobile, registrationCommission, isActive } = req.body;

        employee.name = name || employee.name;
        employee.email = email || employee.email;
        employee.mobile = mobile || employee.mobile;
        employee.registrationCommission = registrationCommission !== undefined ? registrationCommission : employee.registrationCommission;
        employee.isActive = isActive !== undefined ? isActive : employee.isActive;

        const updated = await employee.save();
        res.json(updated);
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
        const { name, email, mobile, password, permissions, city, state } = req.body;
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
            state: state || 'Delhi'
        });

        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions
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
        const { name, email, mobile, password, permissions } = req.body;
        const admin = await User.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: 'Admin not found' });

        admin.name = name || admin.name;
        admin.email = email || admin.email;
        admin.mobile = mobile || admin.mobile;
        admin.permissions = permissions || admin.permissions;

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
        const { ownerName, mobile, password, email, address, city, state, businessType } = req.body;

        const providerExists = await Provider.findOne({ mobile });
        if (providerExists) {
            return res.status(400).json({ message: 'Mobile number already registered as a provider' });
        }

        // Generate a vendor code for Sewak
        const count = await Provider.countDocuments();
        const vendorCode = `RSSEW${String(count + 1).padStart(5, '0')}`;

        const sewak = await Provider.create({
            ownerName,
            shopName: `${ownerName} (Sewak)`,
            mobile,
            password,
            email,
            address,
            city,
            state,
            businessType: businessType || 'Internal Service',
            vendorCode,
            status: 'verified', // Automatically verified
            providerCategory: 'sewak',
            commissionRate: 100, // 100% to Admin
            isOnline: true,
            documents: req.body.documents || []
        });

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
    deleteEmergencyAlert,
    getAllAdmins,
    createAdmin,
    updateAdminPermissions,
    verifySuperAdminPin,
    updateSuperAdminPin,
    deleteAdmin,
    updateAdmin,
    getAllSewaks,
    createSewak
};
