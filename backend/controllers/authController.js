const User = require('../models/User');
const Provider = require('../models/Provider');
const { Wallet } = require('../models/Wallet');
const generateToken = require('../utils/generateToken');
const OTP = require('../models/OTP');
const { sendSMSOTP } = require('../utils/smsService');
const { sendEmail } = require('../utils/emailService');

// @desc    Send OTP to mobile
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
    const { mobile } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });

    try {
        // Handle test number bypass
        if (mobile === '9999900000' || mobile === '8888888888' || mobile === '9999911111') {
            await OTP.findOneAndUpdate(
                { mobile },
                { otp: '123456', createdAt: new Date() },
                { upsert: true, new: true }
            );
            return res.json({ success: true, message: 'Test OTP generated' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB (upsert)
        await OTP.findOneAndUpdate(
            { mobile },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Send SMS
        const result = await sendSMSOTP(mobile, otp);

        if (result.success) {
            res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send SMS', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
    const { mobile, otp } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile) || !otp) return res.status(400).json({ message: 'Valid 10-digit mobile and OTP required' });

    try {
        const otpDoc = await OTP.findOne({ mobile, otp });

        if (otpDoc) {
            // Delete OTP after verification
            await OTP.deleteOne({ _id: otpDoc._id });
            res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, mobile, password, role, address, city, state } = req.body;

    if (!mobile || !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
    }

    try {
        const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
        if (userExists) {
            return res.status(400).json({ message: userExists.mobile === mobile ? 'Mobile number is already registered' : 'Email is already registered' });
        }
        
        const providerExists = await Provider.findOne({ $or: [{ email }, { mobile }] });
        if (providerExists) {
            return res.status(400).json({ message: providerExists.mobile === mobile ? 'Mobile number is already registered as a Provider' : 'Email is already registered as a Provider' });
        }

        const user = await User.create({
            name,
            email,
            mobile,
            password,
            address,
            city,
            state,
            role: role || 'customer',
            location: req.body.location || { type: 'Point', coordinates: [0, 0] }
        });

        if (user) {
            // Create user wallet
            await Wallet.create({
                userId: user._id,
                balance: 0, 
            });

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                city: user.city,
                address: user.address,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user with OTP & get token
// @route   POST /api/auth/login-otp
// @access  Public
const loginWithOTP = async (req, res) => {
    const { mobile, otp } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile) || !otp) return res.status(400).json({ message: 'Valid 10-digit mobile and OTP required' });

    try {
        // Handle test number bypass
        if ((mobile === '9999900000' || mobile === '8888888888' || mobile === '9999911111') && otp === '123456') {
            // Allow bypass
        } else {
            const otpDoc = await OTP.findOne({ mobile, otp });
            if (!otpDoc) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            // Delete OTP after successful login
            await OTP.deleteOne({ _id: otpDoc._id });
        }

        let user = null;
        let isProvider = false;

        if (req.body.type === 'provider' || req.body.type === 'sewak') {
            user = await Provider.findOne({ mobile });
            isProvider = !!user;
        } else {
            user = await User.findOne({ mobile });
            isProvider = false;
        }

        if (!user) {
            return res.status(404).json({ message: 'No account found with this mobile number' });
        }

        res.json({
            success: true,
            message: "Login successful",
            data: {
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    name: user.name || user.ownerName,
                    email: user.email,
                    phone: user.mobile,
                    mobile: user.mobile,
                    role: user.role || (isProvider ? 'provider' : 'customer'),
                    city: user.city || "",
                    address: user.address || "",
                    avatar: user.avatar || user.profileImage,
                    providerCategory: isProvider ? (user.providerCategory || "partner") : undefined
                }
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { identifier, password } = req.body;
    console.log(`Login attempt for: ${identifier}`);

    try {
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { mobile: identifier }
            ]
        });

        if (user) {
            console.log(`User found in DB: ${user.email}, ${user.role}`);
            const isMatch = await user.matchPassword(password);
            console.log(`Password match result: ${isMatch}`);

            if (isMatch) {
                res.json({
                    success: true,
                    message: "Login successful",
                    data: {
                        token: generateToken(user._id),
                        user: {
                            id: user._id,
                            name: user.name,
                            email: user.email,
                            phone: user.mobile,
                            mobile: user.mobile,
                            role: user.role,
                            city: user.city,
                            address: user.address,
                            avatar: user.avatar
                        }
                    }
                });
            } else {
                res.status(401).json({ message: 'Invalid email/mobile or password' });
            }
        } else {
            console.log(`User NOT found for identifier: ${identifier}`);
            res.status(401).json({ message: 'Invalid email/mobile or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        let user = await User.findById(req.user._id);

        if (!user) {
            user = await Provider.findById(req.user._id);
        }

        if (user) {
            let debtLimitExceeded = false;
            let currentDebt = 0;
            let allowedLimit = 0;
            if (user.ownerName || user.providerCategory) { // it's a provider
                const { Wallet } = require('../models/Wallet');
                const Setting = require('../models/Setting');
                const wallet = await Wallet.findOne({ providerId: user._id });
                if (wallet && wallet.balance < 0) {
                    const configSetting = await Setting.findOne({ key: 'cash_limits_config' });
                    let limit = 1500;
                    if (configSetting && configSetting.value) {
                        const cfg = configSetting.value;
                        limit = Number(cfg.defaultLimit) || 1500;
                        if (user.vendorType) {
                            const catId = user.vendorType.toString();
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
            }

            res.json({
                _id: user._id,
                name: user.name || user.ownerName, // Handle both models
                email: user.email,
                mobile: user.mobile,
                role: user.role || (user.ownerName ? 'provider' : 'customer'),
                avatar: user.avatar || user.profileImage,
                addresses: user.addresses || [],
                city: user.city || "",
                address: user.address || "",
                favorites: user.favorites || [],
                vendorCode: user.vendorCode || "",
                commissionFreeBookings: user.commissionFreeBookings || 0,
                permissions: user.permissions || [],
                providerCategory: user.providerCategory || "partner",
                employeeCode: user.role === 'supervisor' || user.role === 'employee' ? (await require('../models/Employee').findOne({ userId: user._id }))?.ownCode : "",
                allowedCreationScope: user.role === 'supervisor' ? (await require('../models/Employee').findOne({ userId: user._id }))?.allowedCreationScope || 'employee_only' : undefined,
                debtLimitExceeded,
                currentDebt,
                allowedLimit
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const { name, email, mobile, avatar, addresses, favorites, city, address } = req.body;

    try {
        let user = await User.findById(req.user._id);
        let isProvider = false;

        if (!user) {
            user = await Provider.findById(req.user._id);
            isProvider = !!user;
        }

        if (user) {
            if (isProvider) {
                user.ownerName = name || user.ownerName;
                user.profileImage = avatar !== undefined ? avatar : user.profileImage;
            } else {
                user.name = name || user.name;
                user.avatar = avatar !== undefined ? avatar : user.avatar;
            }

            user.email = email || user.email;
            user.mobile = mobile || user.mobile;
            user.addresses = addresses !== undefined ? addresses : user.addresses;
            user.favorites = favorites !== undefined ? favorites : user.favorites;

            if (city !== undefined) {
                user.city = city;
            }
            if (address !== undefined) {
                user.address = address;
            }

            if (req.body.location) {
                user.location = req.body.location;
            }

            const updatedUser = await user.save();

            const { notifyUser } = require('../config/notificationService');
            await notifyUser({
                userId: updatedUser._id,
                userRole: isProvider ? 'provider' : 'user',
                title: 'Profile Updated',
                message: 'Your profile information has been successfully updated.',
                type: 'system'
            });

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name || updatedUser.ownerName,
                email: updatedUser.email,
                mobile: updatedUser.mobile,
                role: updatedUser.role || (isProvider ? 'provider' : 'customer'),
                avatar: updatedUser.avatar || updatedUser.profileImage,
                addresses: updatedUser.addresses,
                city: updatedUser.city || "",
                address: updatedUser.address || "",
                favorites: updatedUser.favorites,
                providerCategory: updatedUser.providerCategory || "partner",
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user && (await user.matchPassword(currentPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user account
// @route   DELETE /api/auth/profile
// @access  Private
const deleteUserAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            // Delete user wallet as well
            await Wallet.deleteOne({ userId: user._id });
            await User.deleteOne({ _id: user._id });
            res.json({ message: 'Account deleted successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if user exists
// @route   POST /api/auth/check-existence
// @access  Public
const checkUserExistence = async (req, res) => {
    const { mobile, type } = req.body;
    try {
        if (type === 'provider') {
            const provider = await Provider.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            return res.json({ exists: !!provider });
        } else if (type === 'user') {
            const user = await User.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            return res.json({ exists: !!user });
        } else {
            const user = await User.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            const provider = await Provider.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            return res.json({ exists: !!user || !!provider });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyCredentials = async (req, res) => {
    const { mobile, password, type } = req.body;
    try {
        let user = null;
        let isProvider = false;

        if (type === 'provider') {
            user = await Provider.findOne({ mobile });
            isProvider = !!user;
            if (!user) {
                user = await User.findOne({ mobile });
                isProvider = false;
            }
        } else {
            user = await User.findOne({ mobile });
            if (!user) {
                user = await Provider.findOne({ mobile });
                isProvider = !!user;
            }
        }

        if (user && (await user.matchPassword(password))) {
            res.json({ success: true, isProvider });
        } else {
            res.status(401).json({ success: false, message: 'Invalid mobile or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addAddress = async (req, res) => {
    const { label, address, icon, location } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.addresses.push({ label, address, icon, location });
        await user.save();

        res.status(201).json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
        await user.save();

        res.json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addFavorite = async (req, res) => {
    const { providerId } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.favorites.includes(providerId)) {
            user.favorites.push(providerId);
            await user.save();
        }

        res.status(201).json(user.favorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteFavorite = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.favorites = user.favorites.filter(fav => fav.toString() !== req.params.id);
        await user.save();

        res.json(user.favorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('favorites', 'ownerName shopName mobile profileImage providerCategory');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const mappedFavorites = user.favorites.map(fav => ({
            id: fav._id,
            name: fav.shopName || fav.ownerName,
            category: fav.providerCategory || "Partner",
            image: fav.profileImage || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
            rating: 4.5, // Dummy for now
            reviews: 100, // Dummy for now
            distance: "2.0 km", // Dummy for now
            price: "199", // Dummy for now
            verified: true
        }));

        res.json(mappedFavorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forgot Password (reset using OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { mobile, otp, newPassword, type } = req.body;
    if (!mobile || !otp || !newPassword) return res.status(400).json({ message: 'Mobile, OTP and new password are required' });

    try {
        // Handle test number bypass
        if ((mobile === '9999900000' || mobile === '8888888888' || mobile === '9999911111') && otp === '123456') {
            // Allow bypass
        } else {
            const otpDoc = await OTP.findOne({ mobile, otp });
            if (!otpDoc) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            // Delete OTP after successful verification
            await OTP.deleteOne({ _id: otpDoc._id });
        }

        let user = null;
        if (type === 'provider') {
            user = await Provider.findOne({ mobile });
            if (!user) user = await User.findOne({ mobile });
        } else {
            user = await User.findOne({ mobile });
            if (!user) user = await Provider.findOne({ mobile });
        }

        if (!user) {
            return res.status(404).json({ message: 'No account found with this mobile number' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email-otp
// @access  Public
const verifyEmailOtp = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    try {
        const otpDoc = await OTP.findOne({ email, otp });

        if (otpDoc) {
            await OTP.deleteOne({ _id: otpDoc._id });
            res.json({ success: true, message: 'Email verified successfully' });
        } else {
            res.status(400).json({ message: 'Invalid or expired OTP' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send OTP to email
// @route   POST /api/auth/send-email-otp
// @access  Public
const sendEmailOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email address is required' });

    try {
        const userExists = await User.findOne({ email });
        const providerExists = await Provider.findOne({ email });
        
        if (userExists || providerExists) {
            return res.status(400).json({ message: 'Email is already registered with another account' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB (upsert)
        await OTP.findOneAndUpdate(
            { email },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Send Email
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>RozSewa Email Verification</h2>
                <p>Your OTP for email verification is:</p>
                <h1 style="color: #10b981; letter-spacing: 5px;">${otp}</h1>
                <p>This OTP will expire in 5 minutes.</p>
            </div>
        `;
        const result = await sendEmail(email, "Verify Your Email - RozSewa", html);

        if (result.success) {
            res.json({ success: true, message: 'OTP sent to email successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send email OTP', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    sendEmailOtp,
    verifyEmailOtp,
    authUser,
    getUserProfile,
    updateUserProfile,
    updatePassword,
    deleteUserAccount,
    checkUserExistence,
    sendOTP,
    verifyOTP,
    loginWithOTP,
    verifyCredentials,
    addAddress,
    deleteAddress,
    addFavorite,
    deleteFavorite,
    getFavorites,
    forgotPassword
};
