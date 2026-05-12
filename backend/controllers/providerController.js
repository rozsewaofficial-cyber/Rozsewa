const Provider = require('../models/Provider');
const generateToken = require('../utils/generateToken');
const Employee = require('../models/Employee');

// @desc    Register a new provider
// @route   POST /api/provider/register
// @access  Public
const registerProvider = async (req, res) => {
    const {
        mobile, ownerName, shopName, password, businessType, vendorType, subServices, profileImage, address, city, state,
        gst, kycAadhaar, kycAadhaarPhoto, kycAadhaarBackPhoto, kycPanNumber, kycPanPhoto, referralCode, employeeCode, registrationType, referredBy,
        bankDetails
    } = req.body;

    try {
        const providerExists = await Provider.findOne({ mobile });

        if (providerExists) {
            return res.status(400).json({ message: 'Provider already exists with this mobile number' });
        }

        // Generate a random vendor code RSVND + 5 digits
        const vendorCode = "RSVND" + Math.floor(10000 + Math.random() * 90000);

        // Core dynamic logic for First 3 Free services & Payouts
        let freeServicesLeft = 3; // Always 3 free for new vendors per request

        // Handle referral and onboarding logic
        let onboardedByStaff = null;
        if (referredBy) {
            // Check for both Field Staff and General Employees
            const employee = await Employee.findOne({ ownCode: referredBy });
            if (employee) {
                if (employee.role === 'field_staff') {
                    onboardedByStaff = employee.ownCode;
                }
                
                employee.referralCount = (employee.referralCount || 0) + 1;
                employee.totalEarnings = (employee.totalEarnings || 0) + (employee.registrationCommission || 50);
                await employee.save();
                console.log(`Bonus: Commission added to ${employee.role} ${employee.ownCode}`);
            } else if (registrationType === 'vendor_referral') {
                 // Existing vendor referral logic
                 const referringVendor = await Provider.findOne({ vendorCode: referredBy });
                 if (referringVendor) {
                     referringVendor.freeServicesLeft = (referringVendor.freeServicesLeft || 0) + 3;
                     await referringVendor.save();
                 }
            } else {
                return res.status(400).json({ message: 'Invalid referral or staff code' });
            }
        }

        // Prepare initial documents array from registration data
        const initialDocs = [];
        if (kycAadhaarPhoto) initialDocs.push({ id: 'aadhaar_front', url: kycAadhaarPhoto, status: 'pending', fileName: 'Aadhaar_Front.jpg' });
        if (kycAadhaarBackPhoto) initialDocs.push({ id: 'aadhaar_back', url: kycAadhaarBackPhoto, status: 'pending', fileName: 'Aadhaar_Back.jpg' });
        if (kycPanPhoto) initialDocs.push({ id: 'pan', url: kycPanPhoto, status: 'pending', fileName: 'PAN_Registration.jpg' });
        if (gst) initialDocs.push({ id: 'gst', url: gst, status: 'pending', fileName: 'GST_Registration.jpg' });

        const provider = await Provider.create({
            mobile,
            ownerName,
            shopName,
            password: password || "123456",
            businessType,
            vendorType,
            subServices,
            profileImage,
            vendorCode,
            address,
            city,
            state,
            gst,
            kycAadhaar,
            kycAadhaarPhoto,
            kycAadhaarBackPhoto,
            kycPanNumber,
            kycPanPhoto,
            referralCode,
            employeeCode,
            registrationType: registrationType || 'individual',
            referredBy: referredBy || null,
            onboardedByStaff: onboardedByStaff,
            bankDetails: bankDetails || null,
            freeServicesLeft,
            documents: initialDocs,
            location: req.body.location,
            status: 'pending' // Verification required by admin
        });

        // Push Notification for Admins (New KYC Request)
        try {
            const User = require('../models/User');
            const { sendNotificationToUser } = require('../config/notificationService');
            
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            
            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title: 'New KYC Request',
                    body: `New Partner ${ownerName} uploaded documents. Verify now.`,
                    data: {
                        type: 'kyc',
                        id: provider._id.toString(),
                        link: '/admin/kyc'
                    }
                });
            }
        } catch (err) {
            console.log('Admin push notification failed (skipping):', err.message);
        }

        if (provider) {
            res.status(201).json({
                _id: provider._id,
                ownerName: provider.ownerName,
                mobile: provider.mobile,
                shopName: provider.shopName,
                status: provider.status,
                vendorCode: provider.vendorCode,
                vendorType: provider.vendorType,
                businessType: provider.businessType,
                freeServicesLeft: provider.freeServicesLeft,
                isSubscribed: provider.isSubscribed,
                planType: provider.planType,
                token: generateToken(provider._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid provider data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth provider & get token
// @route   POST /api/provider/login
// @access  Public
const authProvider = async (req, res) => {
    const { mobile, password } = req.body;

    try {
        const provider = await Provider.findOne({ mobile });

        if (provider && (await provider.matchPassword(password))) {
            res.json({
                _id: provider._id,
                ownerName: provider.ownerName,
                shopName: provider.shopName,
                mobile: provider.mobile,
                status: provider.status,
                vendorCode: provider.vendorCode,
                vendorType: provider.vendorType,
                businessType: provider.businessType,
                freeServicesLeft: provider.freeServicesLeft,
                isSubscribed: provider.isSubscribed,
                planType: provider.planType,
                role: 'provider',
                token: generateToken(provider._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid mobile or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get provider profile
// @route   GET /api/provider/profile
// @access  Private (Provider)
const getProviderProfile = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);

        if (provider) {
            // Auto-sync legacy documents to the new array if it's empty
            if (!provider.documents || provider.documents.length === 0) {
                let changed = false;
                if (provider.kycAadhaarPhoto) { provider.documents.push({ id: 'aadhaar_front', url: provider.kycAadhaarPhoto, status: 'pending', fileName: 'Aadhaar_Front.jpg' }); changed = true; }
                if (provider.kycAadhaarBackPhoto) { provider.documents.push({ id: 'aadhaar_back', url: provider.kycAadhaarBackPhoto, status: 'pending', fileName: 'Aadhaar_Back.jpg' }); changed = true; }
                if (provider.kycPanPhoto) { provider.documents.push({ id: 'pan', url: provider.kycPanPhoto, status: 'pending', fileName: 'PAN_Registration.jpg' }); changed = true; }
                if (provider.gst && provider.gst.startsWith('http')) { provider.documents.push({ id: 'gst', url: provider.gst, status: 'pending', fileName: 'GST_Registration.jpg' }); changed = true; }

                if (changed) await provider.save();
            }

            // Fix for existing providers: If they are verified, their registration docs should be marked verified
            if (provider.status === 'verified') {
                let statusFixed = false;
                provider.documents.forEach(doc => {
                    if (doc.status === 'pending') {
                        doc.status = 'verified';
                        statusFixed = true;
                    }
                });
                if (statusFixed || !provider.kycVerified) {
                    provider.kycVerified = true;
                    await provider.save();
                }
            }
            res.json(provider);
        } else {
            res.status(404).json({ message: 'Provider not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update provider status (Online/Emergency)
// @route   PATCH /api/provider/status
// @access  Private (Provider)
const updateProviderStatus = async (req, res) => {
    const { isOnline, isEmergencyEnabled } = req.body;

    try {
        const provider = await Provider.findById(req.user._id);

        if (provider) {
            if (isOnline !== undefined) provider.isOnline = isOnline;
            if (isEmergencyEnabled !== undefined) provider.isEmergencyEnabled = isEmergencyEnabled;

            await provider.save();
            res.json({
                message: 'Status updated',
                isOnline: provider.isOnline,
                isEmergencyEnabled: provider.isEmergencyEnabled
            });
        } else {
            res.status(404).json({ message: 'Provider not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update provider profile
// @route   PUT /api/provider/profile
// @access  Private (Provider)
const updateProviderProfile = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);

        if (provider) {
            // Check if critical fields are changing
            const nameChanged = req.body.shopName && req.body.shopName !== provider.shopName;

            provider.ownerName = req.body.ownerName || provider.ownerName;
            provider.shopName = req.body.shopName || provider.shopName;
            provider.email = req.body.email || provider.email;
            provider.vendorType = req.body.category || req.body.vendorType || provider.vendorType;
            provider.address = req.body.address || provider.address;
            provider.profileImage = req.body.profileImage || provider.profileImage;
            provider.openingTime = req.body.openingTime || provider.openingTime;
            provider.closingTime = req.body.closingTime || provider.closingTime;
            
            if (req.body.availability) {
                provider.availability = req.body.availability;
            }

            if (req.body.bankDetails) {
                provider.bankDetails = {
                    ...provider.bankDetails,
                    ...req.body.bankDetails
                };
            }

            if (req.body.location) {
                provider.location = req.body.location;
            }

            // Admin Control: If shop name changes, profile needs re-verification
            if (nameChanged && provider.status === 'verified') {
                provider.status = 'pending';
                provider.kycVerified = false; // Require re-verification
            }

            const updatedProvider = await provider.save();

            res.json({
                _id: updatedProvider._id,
                ownerName: updatedProvider.ownerName,
                shopName: updatedProvider.shopName,
                mobile: updatedProvider.mobile,
                vendorCode: updatedProvider.vendorCode,
                vendorType: updatedProvider.vendorType,
                address: updatedProvider.address,
                profileImage: updatedProvider.profileImage,
                token: generateToken(updatedProvider._id),
            });
        } else {
            res.status(404).json({ message: 'Provider not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get provider earnings stats
// @route   GET /api/provider/stats
// @access  Private (Provider)
const getProviderStats = async (req, res) => {
    try {
        const Booking = require('../models/Booking');
        const bookings = await Booking.find({
            providerId: req.user._id,
            status: 'completed'
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const week = new Date();
        week.setDate(week.getDate() - week.getDay());
        week.setHours(0, 0, 0, 0);

        const month = new Date();
        month.setDate(1);
        month.setHours(0, 0, 0, 0);

        let todayEarnings = 0;
        let weekEarnings = 0;
        let monthEarnings = 0;

        // Dynamic Chart Data
        const performance = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            performance.push({
                day: days[d.getDay()],
                date: new Date(d).setHours(0, 0, 0, 0),
                amount: 0
            });
        }

        bookings.forEach(b => {
            const bDate = new Date(b.createdAt);
            const amt = b.totalAmount || b.totalPrice || b.amount || 0;

            if (bDate >= today) todayEarnings += amt;
            if (bDate >= week) weekEarnings += amt;
            if (bDate >= month) monthEarnings += amt;

            const bDayTime = new Date(b.createdAt).setHours(0, 0, 0, 0);
            const chartDay = performance.find(p => p.date === bDayTime);
            if (chartDay) chartDay.amount += amt;
        });

        res.json({
            today: todayEarnings,
            week: weekEarnings,
            month: monthEarnings,
            totalBookings: bookings.length,
            chartData: performance.map(({ day, amount }) => ({ day, amount }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create an emergency alert
// @route   POST /api/provider/emergency-alert
// @access  Private (Provider)
const sendEmergencyAlert = async (req, res) => {
    try {
        const EmergencyAlert = require('../models/EmergencyAlert');
        const Provider = require('../models/Provider');
        const { coordinates, address } = req.body;
        console.log("SOS TRIGGERED for Provider:", req.user._id, "Coords:", coordinates);
        const provider = await Provider.findById(req.user._id);

        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const alert = await EmergencyAlert.create({
            providerId: req.user._id,
            mobile: provider.mobile,
            location: {
                type: 'Point',
                coordinates: coordinates || provider.location?.coordinates || [0, 0]
            },
            address: address || provider.address,
            status: 'pending'
        });

        // Push Notification for Admins (Emergency SOS)
        try {
            const User = require('../models/User');
            const { sendNotificationToUser } = require('../config/notificationService');
            
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            
            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title: '⚠️ Emergency SOS Triggered!',
                    body: `Provider ${provider.ownerName} (${provider.shopName}) has triggered an SOS emergency!`,
                    data: {
                        type: 'sos',
                        id: provider._id.toString(),
                        link: '/admin/live-map'
                    }
                });
            }
        } catch (err) {
            console.log('Admin push notification failed (skipping):', err.message);
        }

        res.status(201).json({ success: true, alert });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if provider exists
// @route   POST /api/provider/check-existence
// @access  Public
const checkProviderExistence = async (req, res) => {
    const { mobile } = req.body;
    try {
        const provider = await Provider.findOne({ mobile });
        res.json({ exists: !!provider });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload KYC Document
// @route   POST /api/provider/documents
// @access  Private (Provider)
const uploadDocument = async (req, res) => {
    try {
        const { docId } = req.body;
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Check if document of this type already exists
        const docIndex = provider.documents.findIndex(d => d.id === docId);

        const newDoc = {
            id: docId,
            url: req.file.path,
            status: 'pending',
            fileName: req.file.originalname,
            uploadedAt: Date.now()
        };

        if (docIndex > -1) {
            provider.documents[docIndex] = newDoc;
        } else {
            provider.documents.push(newDoc);
        }

        await provider.save();

        // Push Notification for Admins (New KYC Request)
        try {
            const User = require('../models/User');
            const { sendNotificationToUser } = require('../config/notificationService');
            
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            
            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title: 'New KYC Request',
                    body: `Partner ${provider.ownerName} uploaded a new document (${docId}). Verify now.`,
                    data: {
                        type: 'kyc',
                        id: provider._id.toString(),
                        link: '/admin/kyc'
                    }
                });
            }
        } catch (err) {
            console.log('Admin push notification failed (skipping):', err.message);
        }

        res.json({
            message: 'Document uploaded successfully',
            document: newDoc
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify credentials without login
// @route   POST /api/provider/verify-credentials
// @access  Public
const verifyProviderCredentials = async (req, res) => {
    const { mobile, password } = req.body;
    try {
        const provider = await Provider.findOne({ mobile });
        if (provider && (await provider.matchPassword(password))) {
            res.json({ success: true, providerCategory: provider.providerCategory });
        } else {
            res.status(401).json({ message: 'Invalid mobile or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSubscriptionPlans = async (req, res) => {
    try {
        const SubscriptionPlan = require('../models/SubscriptionPlan');
        const Provider = require('../models/Provider');
        
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        const plans = await SubscriptionPlan.find({ 
            isActive: true, 
            $or: [
                { category: provider.vendorType },
                { category: { $exists: false } },
                { category: null }
            ]
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProviderMenu = async (req, res) => {
    try {
        const Setting = require('../models/Setting');
        const menuSetting = await Setting.findOne({ key: 'provider_dashboard_menu' });
        
        if (menuSetting) {
            return res.json(menuSetting.value);
        }

        // Default menu if not set in DB
        const defaultMenu = [
            { iconPath: "/assets/3d_icons/services.png", title: "Services", desc: "Catalog", path: "/provider/services", bgColor: "bg-blue-50/80 dark:bg-blue-900/10", borderColor: "border-blue-100 dark:border-blue-900/20" },
            { iconPath: "/assets/3d_icons/timing.png", title: "Timing", desc: "Schedule", path: "/provider/availability", bgColor: "bg-amber-50/80 dark:bg-amber-900/10", borderColor: "border-amber-100 dark:border-amber-900/20" },
            { iconPath: "/assets/3d_icons/wallet.png", title: "Wallet", desc: "Revenue", path: "/provider/wallet", bgColor: "bg-emerald-50/80 dark:bg-emerald-900/10", borderColor: "border-emerald-100 dark:border-emerald-900/20" },
            { iconPath: "/assets/3d_icons/reviews.png", title: "Reviews", desc: "Ratings", path: "/provider/reviews", bgColor: "bg-yellow-50/80 dark:bg-yellow-900/10", borderColor: "border-yellow-100 dark:border-yellow-900/20" },
            { iconPath: "/assets/3d_icons/99card.png", title: "Registration", desc: "Plan & Status", path: "/provider/99card", bgColor: "bg-slate-100 dark:bg-slate-800/30", borderColor: "border-slate-200 dark:border-slate-700" },
            { iconPath: "/assets/3d_icons/docs.png", title: "Docs", desc: "Vault", path: "/provider/documents", bgColor: "bg-cyan-50/80 dark:bg-cyan-900/10", borderColor: "border-cyan-100 dark:border-cyan-900/20" },
            { iconPath: "/assets/3d_icons/support.png", title: "Support", desc: "Hotline", path: "/provider/support", bgColor: "bg-indigo-50/80 dark:bg-indigo-900/10", borderColor: "border-indigo-100 dark:border-indigo-900/20" },
            { iconPath: "/assets/3d_icons/settings.png", title: "Settings", desc: "Admin", path: "/provider/settings", bgColor: "bg-gray-100/80 dark:bg-gray-800/30", borderColor: "border-gray-200 dark:border-gray-700" }
        ];

        res.json(defaultMenu);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerProvider,
    authProvider,
    getProviderProfile,
    updateProviderStatus,
    updateProviderProfile,
    getProviderStats,
    checkProviderExistence,
    uploadDocument,
    sendEmergencyAlert,
    verifyProviderCredentials,
    getSubscriptionPlans,
    getProviderMenu
};
