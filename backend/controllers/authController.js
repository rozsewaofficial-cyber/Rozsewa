const User = require('../models/User');
const Provider = require('../models/Provider');
const { Wallet } = require('../models/Wallet');
const generateToken = require('../utils/generateToken');
const OTP = require('../models/OTP');
const { sendSMSOTP } = require('../utils/smsService');

// @desc    Send OTP to mobile
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

    try {
        // Handle test number bypass
        if (mobile === '9999900000') {
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
    if (!mobile || !otp) return res.status(400).json({ message: 'Mobile and OTP required' });

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

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
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
                balance: 250, // Initial balance for demo
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
    if (!mobile || !otp) return res.status(400).json({ message: 'Mobile and OTP required' });

    try {
        // Handle test number bypass
        if (mobile === '9999900000' && otp === '123456') {
            // Allow bypass
        } else {
            const otpDoc = await OTP.findOne({ mobile, otp });
            if (!otpDoc) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            // Delete OTP after successful login
            await OTP.deleteOne({ _id: otpDoc._id });
        }

        // OTP is valid, now find user (Customer or Provider)
        let user = await User.findOne({ mobile });
        let isProvider = false;

        if (!user) {
            user = await Provider.findOne({ mobile });
            isProvider = !!user;
        }

        if (!user) {
            return res.status(404).json({ message: 'No account found with this mobile number' });
        }

        res.json({
            _id: user._id,
            name: user.name || user.ownerName,
            email: user.email,
            mobile: user.mobile,
            role: user.role || (isProvider ? 'provider' : 'customer'),
            city: user.city || "",
            address: user.address || "",
            avatar: user.avatar || user.profileImage,
            providerCategory: user.providerCategory || "partner",
            token: generateToken(user._id),
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
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    role: user.role,
                    city: user.city,
                    address: user.address,
                    avatar: user.avatar,
                    token: generateToken(user._id),
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
                employeeCode: user.role === 'supervisor' || user.role === 'employee' ? (await require('../models/Employee').findOne({ userId: user._id }))?.ownCode : ""
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
    const { name, email, mobile, avatar, addresses, favorites } = req.body;

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

            if (req.body.location) {
                user.location = req.body.location;
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name || updatedUser.ownerName,
                email: updatedUser.email,
                mobile: updatedUser.mobile,
                role: updatedUser.role || (isProvider ? 'provider' : 'customer'),
                avatar: updatedUser.avatar || updatedUser.profileImage,
                addresses: updatedUser.addresses,
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
    const { mobile } = req.body;
    try {
        const user = await User.findOne({ phone: mobile }); // Note: User model uses 'phone'
        res.json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyCredentials = async (req, res) => {
    const { mobile, password } = req.body;
    try {
        let user = await User.findOne({ mobile });
        if (!user) user = await Provider.findOne({ mobile });

        if (user && (await user.matchPassword(password))) {
            res.json({ success: true });
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

module.exports = {
    registerUser,
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
    getFavorites
};
