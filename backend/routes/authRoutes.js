const express = require('express');
const router = express.Router();
const {
    registerUser,
    authUser,
    getUserProfile,
    updateUserProfile,
    deleteUserAccount,
    updatePassword,
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
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/login-otp', loginWithOTP);
router.post('/verify-credentials', verifyCredentials);
router.post('/check-existence', checkUserExistence);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/profile', protect, deleteUserAccount);
router.put('/password', protect, updatePassword);

// Dedicated endpoints for sub-resources
router.get('/favorites', protect, getFavorites);
router.post('/addresses', protect, addAddress);
router.delete('/addresses/:id', protect, deleteAddress);
router.post('/favorites', protect, addFavorite);
router.delete('/favorites/:id', protect, deleteFavorite);

module.exports = router;
