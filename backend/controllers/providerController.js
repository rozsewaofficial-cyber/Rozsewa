const Provider = require('../models/Provider');
const generateToken = require('../utils/generateToken');
const Employee = require('../models/Employee');

// @desc    Register a new provider
// @route   POST /api/provider/register
// @access  Public
const registerProvider = async (req, res) => {
    const {
        mobile, ownerName, email, shopName, password, businessType, vendorType, subServices, profileImage, address, city, state,
        gst, kycAadhaar, kycAadhaarPhoto, kycAadhaarBackPhoto, kycPanNumber, kycPanPhoto, referralCode, employeeCode, registrationType, referredBy,
        bankDetails, isHomeVisitAvailable, is24x7
    } = req.body;

    try {
        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
        }

        // Check for duplicates across unique fields
        const existingChecks = [];
        if (mobile) existingChecks.push({ mobile });
        if (req.body.email) existingChecks.push({ email: req.body.email });
        if (kycAadhaar) existingChecks.push({ kycAadhaar });
        if (kycPanNumber) existingChecks.push({ kycPanNumber });
        if (gst) existingChecks.push({ gst });
        if (bankDetails && bankDetails.accountNumber) existingChecks.push({ 'bankDetails.accountNumber': bankDetails.accountNumber });

        if (existingChecks.length > 0) {
            const providerExists = await Provider.findOne({ $or: existingChecks });
            if (providerExists) {
                if (providerExists.mobile === mobile) return res.status(400).json({ message: 'Mobile number is already registered' });
                if (req.body.email && providerExists.email === req.body.email) return res.status(400).json({ message: 'Email is already registered' });
                if (kycAadhaar && providerExists.kycAadhaar === kycAadhaar) return res.status(400).json({ message: 'Aadhaar number is already registered' });
                if (kycPanNumber && providerExists.kycPanNumber === kycPanNumber) return res.status(400).json({ message: 'PAN number is already registered' });
                if (gst && providerExists.gst === gst) return res.status(400).json({ message: 'GST number is already registered' });
                if (bankDetails && providerExists.bankDetails && providerExists.bankDetails.accountNumber === bankDetails.accountNumber) return res.status(400).json({ message: 'Bank account number is already registered' });
            }

            const User = require('../models/User');
            const userExistsChecks = [];
            if (mobile) userExistsChecks.push({ mobile });
            if (req.body.email) userExistsChecks.push({ email: req.body.email });
            if (userExistsChecks.length > 0) {
                const userExists = await User.findOne({ $or: userExistsChecks });
                if (userExists) {
                    if (userExists.mobile === mobile) return res.status(400).json({ message: 'Mobile number is already registered as a Customer' });
                    if (req.body.email && userExists.email === req.body.email) return res.status(400).json({ message: 'Email is already registered as a Customer' });
                }
            }
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
            email,
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
            isHomeVisitAvailable: isHomeVisitAvailable || false,
            is24x7: is24x7 || false,
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

        if (!provider) {
            return res.status(404).json({ message: 'No account found with this mobile number' });
        }

        if (await provider.matchPassword(password)) {
            res.json({
                success: true,
                message: "Login successful",
                data: {
                    token: generateToken(provider._id),
                    user: {
                        id: provider._id,
                        name: provider.ownerName,
                        shopName: provider.shopName,
                        phone: provider.mobile,
                        mobile: provider.mobile,
                        status: provider.status,
                        vendorCode: provider.vendorCode,
                        vendorType: provider.vendorType,
                        businessType: provider.businessType,
                        freeServicesLeft: provider.freeServicesLeft,
                        isSubscribed: provider.isSubscribed,
                        planType: provider.planType,
                        providerCategory: provider.providerCategory || 'partner',
                        role: provider.providerCategory === 'sewak' ? 'sewak' : 'provider'
                    }
                }
            });
        } else {
            res.status(401).json({ message: 'Invalid password' });
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
        const providerDoc = await Provider.findById(req.user._id);

        if (providerDoc) {
            // Auto-sync legacy documents to the new array if it's empty
            if (!providerDoc.documents || providerDoc.documents.length === 0) {
                let changed = false;
                if (providerDoc.kycAadhaarPhoto) { providerDoc.documents.push({ id: 'aadhaar_front', url: providerDoc.kycAadhaarPhoto, status: 'pending', fileName: 'Aadhaar_Front.jpg' }); changed = true; }
                if (providerDoc.kycAadhaarBackPhoto) { providerDoc.documents.push({ id: 'aadhaar_back', url: providerDoc.kycAadhaarBackPhoto, status: 'pending', fileName: 'Aadhaar_Back.jpg' }); changed = true; }
                if (providerDoc.kycPanPhoto) { providerDoc.documents.push({ id: 'pan', url: providerDoc.kycPanPhoto, status: 'pending', fileName: 'PAN_Registration.jpg' }); changed = true; }
                if (providerDoc.gst && providerDoc.gst.startsWith('http')) { providerDoc.documents.push({ id: 'gst', url: providerDoc.gst, status: 'pending', fileName: 'GST_Registration.jpg' }); changed = true; }

                if (changed) await providerDoc.save();
            }

            // Fix for existing providers: If they are verified, their registration docs should be marked verified
            if (providerDoc.status === 'verified') {
                let statusFixed = false;
                providerDoc.documents.forEach(doc => {
                    if (doc.status === 'pending') {
                        doc.status = 'verified';
                        statusFixed = true;
                    }
                });
                if (statusFixed || !providerDoc.kycVerified) {
                    providerDoc.kycVerified = true;
                    await providerDoc.save();
                }
            }

            const provider = providerDoc.toObject();

            // Debt Limit Logic
            const { Wallet } = require('../models/Wallet');
            const Setting = require('../models/Setting');
            let debtLimitExceeded = false;
            let currentDebt = 0;
            let allowedLimit = 0;
            
            const wallet = await Wallet.findOne({ providerId: provider._id });
            if (wallet && wallet.balance < 0) {
                const configSetting = await Setting.findOne({ key: 'cash_limits_config' });
                let limit = 1500;
                if (configSetting && configSetting.value) {
                    const cfg = configSetting.value;
                    limit = Number(cfg.defaultLimit) || 1500;
                    if (provider.vendorType) {
                        const catId = provider.vendorType.toString();
                        const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
                        if (catLimitObj) limit = Number(catLimitObj.limit);
                    }
                }
                if (wallet.balance <= -limit) {
                    debtLimitExceeded = true;
                    currentDebt = Math.abs(wallet.balance);
                    allowedLimit = limit;
                }
            }

            provider.debtLimitExceeded = debtLimitExceeded;
            provider.currentDebt = currentDebt;
            provider.allowedLimit = allowedLimit;

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

            if (req.body.email && req.body.email !== provider.email) {
                const emailExists = await Provider.findOne({ email: req.body.email, _id: { $ne: provider._id } });
                if (emailExists) return res.status(400).json({ message: 'Email is already registered with another account' });
            }

            // --- Validate serviceRadius against admin-configured limits ---
            if (req.body.serviceRadius !== undefined && req.body.serviceRadius !== null) {
                const Setting = require('../models/Setting');
                const radiusLimitSetting = await Setting.findOne({ key: 'provider_service_radius_limits' });
                const limits = (radiusLimitSetting && radiusLimitSetting.value)
                    ? radiusLimitSetting.value
                    : { minimumRadius: 1, maximumRadius: 50 };

                const submittedRadius = Number(req.body.serviceRadius);
                if (isNaN(submittedRadius)) {
                    return res.status(400).json({ message: 'serviceRadius must be a valid number.' });
                }
                if (submittedRadius < limits.minimumRadius || submittedRadius > limits.maximumRadius) {
                    return res.status(400).json({
                        message: `serviceRadius must be between ${limits.minimumRadius} km and ${limits.maximumRadius} km.`,
                        minimumRadius: limits.minimumRadius,
                        maximumRadius: limits.maximumRadius
                    });
                }
                provider.serviceRadius = submittedRadius;
            }

            provider.ownerName = req.body.ownerName || provider.ownerName;
            provider.shopName = req.body.shopName || provider.shopName;
            provider.email = req.body.email || provider.email;
            const targetCategory = req.body.category || req.body.vendorType;
            if (targetCategory && targetCategory !== (provider.vendorType ? provider.vendorType.toString() : '')) {
                provider.vendorType = targetCategory;
                const Category = require('../models/Category');
                const newCat = await Category.findById(targetCategory);
                if (newCat && newCat.services) {
                    provider.subServices = newCat.services.map(s => s._id.toString());
                } else {
                    provider.subServices = [];
                }
            }
            provider.address = req.body.address || provider.address;
            provider.profileImage = req.body.profileImage || provider.profileImage;
            provider.openingTime = req.body.openingTime || provider.openingTime;
            provider.closingTime = req.body.closingTime || provider.closingTime;
            
            if (req.body.availability) {
                provider.availability = req.body.availability;
            }
            if (req.body.is24x7 !== undefined) {
                provider.is24x7 = req.body.is24x7;
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

            if (req.body.surakshaNidhiOptIn !== undefined) {
                provider.surakshaNidhiOptIn = req.body.surakshaNidhiOptIn;
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
                serviceRadius: updatedProvider.serviceRadius,
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

        // Respond to the provider immediately to prevent UI blocking
        res.status(201).json({ success: true, alert });

        // Process admin notifications and socket emits in the background
        (async () => {
            try {
                const User = require('../models/User');
                const { notifyUser } = require('../config/notificationService');
                const { getIO } = require('../config/socket');

                const populatedAlert = await EmergencyAlert.findById(alert._id)
                    .populate('providerId', 'name shopName ownerName mobile address location');

                const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
                const io = getIO();

                for (const admin of admins) {
                    try {
                        // 1. Emit socket event for real-time list update on AdminEmergency dashboard
                        io.to(`user_${admin._id.toString()}`).emit('NEW_SOS_ALERT', populatedAlert);

                        // 2. Call notifyUser to handle In-App Notification (DB record), Socket (toast notification), and FCM push notification
                        notifyUser({
                            userId: admin._id,
                            userRole: 'admin',
                            title: '⚠️ Emergency SOS Triggered!',
                            message: `Provider ${provider.ownerName} (${provider.shopName}) has triggered an SOS emergency!`,
                            type: 'sos',
                            data: {
                                type: 'sos',
                                id: provider._id.toString(),
                                link: '/admin/live-map'
                            }
                        });
                    } catch (adminErr) {
                        console.error(`Failed to send SOS notification to admin ${admin._id}:`, adminErr.message);
                    }
                }
            } catch (err) {
                console.error('Background admin push notification failed:', err.message);
            }
        })();
    } catch (error) {
        // Only call res.status if headers have not been sent yet
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        } else {
            console.error("Error after headers sent in sendEmergencyAlert:", error);
        }
    }
};

// @desc    Check if provider exists
// @route   POST /api/provider/check-existence
// @access  Public
const checkProviderExistence = async (req, res) => {
    const { mobile } = req.body;
    try {
        const provider = await Provider.findOne({ mobile });
        if (provider) {
            return res.json({ exists: true, message: 'Mobile number is already registered as a Provider' });
        }
        
        const User = require('../models/User');
        const user = await User.findOne({ mobile });
        if (user) {
            return res.json({ exists: true, message: 'Mobile number is already registered as a Customer' });
        }

        res.json({ exists: false });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload KYC Document
// @route   POST /api/provider/documents
// @access  Private (Provider)
const uploadDocument = async (req, res) => {
    try {
        const { docId, docNumber } = req.body;

        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Update document numbers in provider profile
        if (docId === 'aadhaar' && docNumber) provider.kycAadhaar = docNumber;
        if (docId === 'pan' && docNumber) provider.kycPanNumber = docNumber.toUpperCase();
        if (docId === 'gst' && docNumber) provider.gst = docNumber.toUpperCase();
        if (docId === 'police' && docNumber) provider.kycPoliceVerification = docNumber.toUpperCase();

        // Check if document of this type already exists
        const docIndex = provider.documents.findIndex(d => d.id === docId);

        const newDoc = {
            id: docId,
            url: req.file ? req.file.path : 'API_Verified',
            status: 'verified', // Backend trusts the frontend API validation check
            fileName: req.file ? req.file.originalname : `Verified_${docId}`,
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

        const Category = require('../models/Category');
        
        const mongoose = require('mongoose');
        let catId = null;
        if (provider.vendorType) {
            if (mongoose.Types.ObjectId.isValid(provider.vendorType)) {
                catId = provider.vendorType;
            } else {
                const cat = await Category.findOne({ name: new RegExp('^' + provider.vendorType + '$', 'i') });
                if (cat) catId = cat._id;
            }
        }

        const queryOr = [
            { category: { $exists: false } },
            { category: null }
        ];
        if (catId) {
            queryOr.push({ category: catId });
        }

        const userCategory = provider.providerCategory || 'partner';
        const roleQueryOr = [
            { providerCategory: { $exists: false } },
            { providerCategory: null },
            { providerCategory: 'all' },
            { providerCategory: userCategory }
        ];

        const plans = await SubscriptionPlan.find({ 
            status: 'active', 
            $or: queryOr,
            $and: [{ $or: roleQueryOr }]
        }).sort({ displayOrder: 1 });
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
            { iconPath: "/assets/3d_icons/services.png", title: "Leads", desc: "Broadcasts", path: "/provider/leads", bgColor: "bg-violet-50/80 dark:bg-violet-900/10", borderColor: "border-violet-100 dark:border-violet-900/20" },
            { iconPath: "/assets/3d_icons/reviews.png", title: "Reviews", desc: "Ratings", path: "/provider/reviews", bgColor: "bg-yellow-50/80 dark:bg-yellow-900/10", borderColor: "border-yellow-100 dark:border-yellow-900/20" },
            { iconPath: "/assets/3d_icons/99card.png", title: "Registration", desc: "Plan & Status", path: "/provider/99card", bgColor: "bg-slate-100 dark:bg-slate-800/30", borderColor: "border-slate-200 dark:border-slate-700" },
            { iconPath: "/assets/3d_icons/docs.png", title: "Docs", desc: "Vault", path: "/provider/documents", bgColor: "bg-cyan-50/80 dark:bg-cyan-900/10", borderColor: "border-cyan-100 dark:border-cyan-900/20" },
            { iconPath: "/assets/3d_icons/support.png", title: "Support", desc: "Hotline", path: "/provider/support", bgColor: "bg-indigo-50/80 dark:bg-indigo-900/10", borderColor: "border-indigo-100 dark:border-indigo-900/20" },
            { iconPath: "/assets/3d_icons/reviews.png", title: "Promotions", desc: "Banners", path: "/provider/banner-promotions", bgColor: "bg-pink-50/80 dark:bg-pink-900/10", borderColor: "border-pink-100 dark:border-pink-900/20" },
            { iconPath: "/assets/3d_icons/settings.png", title: "Settings", desc: "Admin", path: "/provider/settings", bgColor: "bg-gray-100/80 dark:bg-gray-800/30", borderColor: "border-gray-200 dark:border-gray-700" }
        ];

        res.json(defaultMenu);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const uploadLiveVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No video file provided' });
        }

        const { verificationScript, verificationCode, scriptVersion = 'v1' } = req.body;
        if (!verificationScript || !verificationCode) {
            return res.status(400).json({ message: 'Verification script and code are required' });
        }

        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        // Validate size < 20MB
        const sizeInBytes = req.file.size;
        if (sizeInBytes > 20 * 1024 * 1024) {
            return res.status(400).json({ message: 'Video file size must be less than 20MB' });
        }

        const { cloudinary } = require('../config/cloudinary');

        // Helper to upload buffer as a video to Cloudinary
        const uploadFromBuffer = (fileBuffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'rojsewa/kyc_videos',
                        resource_type: 'video'
                    },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                stream.end(fileBuffer);
            });
        };

        const result = await uploadFromBuffer(req.file.buffer);

        // Server side validation of duration (15s to 30s)
        const duration = result.duration;
        if (duration < 15 || duration > 30) {
            // Delete from Cloudinary
            await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' });
            return res.status(400).json({
                message: `Video duration must be between 15 and 30 seconds. Your video was ${Math.round(duration)} seconds.`
            });
        }

        // Generate thumbnail URL by replacing extension with .jpg
        const secureUrl = result.secure_url;
        const lastDotIndex = secureUrl.lastIndexOf('.');
        const baseUrlWithoutExt = secureUrl.substring(0, lastDotIndex);
        const thumbnailUrl = `${baseUrlWithoutExt}.jpg`;

        // Find existing live_video document or create new
        const docIndex = provider.documents.findIndex(d => d.id === 'live_video');

        const liveVideoDoc = {
            id: 'live_video',
            url: secureUrl,
            fileUrl: secureUrl,
            status: 'draft',
            fileName: req.file.originalname || 'live_video.webm',
            uploadedAt: new Date(),
            thumbnailUrl: thumbnailUrl,
            duration: Math.round(duration),
            verificationScript,
            verificationCode,
            scriptVersion,
            cloudinaryPublicId: result.public_id,
            bytes: result.bytes,
            format: result.format,
            width: result.width,
            height: result.height,
            rejectionReason: null,
            adminNotes: null
        };

        if (docIndex > -1) {
            provider.documents[docIndex] = liveVideoDoc;
        } else {
            provider.documents.push(liveVideoDoc);
        }

        await provider.save();

        // Notify Provider
        try {
            const { sendNotificationToUser } = require('../config/notificationService');
            await sendNotificationToUser(provider._id, 'provider', {
                title: 'Live Video Uploaded',
                body: 'Your live verification video has been successfully uploaded.',
                data: { type: 'kyc', id: provider._id.toString() }
            });
        } catch (notificationErr) {
            console.error('Failed to send upload notification:', notificationErr.message);
        }

        res.json({
            success: true,
            message: 'Live video uploaded successfully',
            document: liveVideoDoc
        });

    } catch (error) {
        console.error('Live video upload error:', error);
        res.status(500).json({ message: error.message });
    }
};

const submitKYC = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        const docs = provider.documents || [];
        const aadhaarDoc = docs.find(d => d.id === 'aadhaar');
        const panDoc = docs.find(d => d.id === 'pan');
        const liveVideoDoc = docs.find(d => d.id === 'live_video');

        if (!aadhaarDoc || aadhaarDoc.status === 'rejected') {
            return res.status(400).json({ message: 'A valid Aadhaar card is required.' });
        }
        if (!panDoc || panDoc.status === 'rejected') {
            return res.status(400).json({ message: 'A valid PAN card is required.' });
        }
        if (!liveVideoDoc || liveVideoDoc.status === 'rejected') {
            return res.status(400).json({ message: 'A valid Live Video Verification is required.' });
        }

        const isReSubmission = provider.kycSubmitted;
        provider.kycSubmitted = true;
        
        // Change status of documents and video to 'pending' if they were draft
        provider.documents.forEach(doc => {
            if (doc.status === 'draft') {
                doc.status = 'pending';
            }
        });

        // Set status based on review progress
        if (provider.kycStatus === 'draft' || provider.kycStatus === 'rejected') {
            provider.kycStatus = 'submitted';
            provider.status = 'pending';
        }

        await provider.save();

        const { sendNotificationToUser } = require('../config/notificationService');
        const User = require('../models/User');

        // Notify Provider
        try {
            await sendNotificationToUser(provider._id, 'provider', {
                title: 'KYC Submitted',
                body: 'Your KYC application has been successfully submitted and is under review.',
                data: { type: 'kyc', id: provider._id.toString() }
            });
        } catch (err) {
            console.error('Failed to notify provider on submit:', err.message);
        }

        // Notify Admins
        try {
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            const title = isReSubmission ? 'KYC Re-submitted' : 'New KYC Request';
            const body = isReSubmission 
                ? `Partner ${provider.ownerName} has re-submitted their rejected KYC items.`
                : `New Partner ${provider.ownerName} has submitted their KYC application.`;

            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title,
                    body,
                    data: {
                        type: 'kyc',
                        id: provider._id.toString(),
                        link: '/admin/verify-sewaks'
                    }
                });
            }
        } catch (err) {
            console.error('Failed to notify admins on submit:', err.message);
        }

        res.json({
            success: true,
            message: 'KYC submitted successfully',
            kycStatus: provider.kycStatus,
            kycSubmitted: provider.kycSubmitted
        });

    } catch (error) {
        console.error('KYC Submit Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const reapplyKYC = async (req, res) => {
    try {
        const Provider = require('../models/Provider');
        const provider = await Provider.findById(req.user._id);
        if (!provider) {
            return res.status(404).json({ message: 'Provider not found' });
        }

        if (provider.status !== 'rejected') {
            return res.status(400).json({ message: 'Only rejected applications can be reapplied' });
        }

        provider.status = 'pending';
        provider.kycStatus = 'submitted';
        provider.kycSubmitted = true;
        // reset rejected documents to pending so they can be re-uploaded
        provider.documents.forEach(doc => {
            if (doc.status === 'rejected') {
                doc.status = 'pending';
            }
        });
        
        await provider.save();
        res.json({ message: 'Reapplied successfully', status: provider.status });
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
    getProviderMenu,
    reapplyKYC,
    uploadLiveVideo,
    submitKYC
};
