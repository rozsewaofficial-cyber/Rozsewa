const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware'); // Generic protect for user
// NOTE: For dual authentication (User/Provider), we might need an auth middleware that checks either token.
// Assuming your system has a way to verify token and attach either req.user or req.provider.
// I will use a combined custom middleware or rely on existing ones.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Provider = require('../models/Provider');

// Custom middleware to authenticate both Users and Providers
const protectBoth = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Check if it's a User
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                req.user = user;
                return next();
            }

            // Check if it's a Provider
            const provider = await Provider.findById(decoded.id).select('-password');
            if (provider) {
                req.provider = provider;
                return next();
            }

            return res.status(401).json({ message: 'Not authorized, user/provider not found' });
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

router.get('/:bookingId', protectBoth, getMessages);
router.post('/:bookingId', protectBoth, sendMessage);

module.exports = router;
