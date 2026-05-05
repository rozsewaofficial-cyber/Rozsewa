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
    verifyCredentials
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

module.exports = router;
