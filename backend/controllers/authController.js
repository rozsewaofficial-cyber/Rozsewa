const User = require('../models/User');
const Provider = require('../models/Provider');
const { Wallet } = require('../models/Wallet');
const generateToken = require('../utils/generateToken');

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

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { identifier, password } = req.body; // 'identifier' can be email or phone

    try {
        // Search for user by email OR mobile
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { mobile: identifier }
            ]
        });

        if (user && (await user.matchPassword(password))) {
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
    } catch (error) {
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

module.exports = {
    registerUser,
    authUser,
    getUserProfile,
    updateUserProfile,
    updatePassword,
    deleteUserAccount,
    checkUserExistence,
};
