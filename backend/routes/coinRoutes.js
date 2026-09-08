const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getMyWallet,
    getMyHistory,
    getQuote,
    createHold,
    releaseHold,
    getMyReferral,
    applyReferralCode
} = require('../controllers/coinController');

// Shared by customers, partners and sewaks — the controller resolves which
// wallet the caller owns and enforces what it may be spent on.
router.get('/wallet', protect, getMyWallet);
router.get('/history', protect, getMyHistory);
router.post('/quote', protect, getQuote);
router.post('/hold', protect, createHold);
router.post('/release', protect, releaseHold);

// Referrals are a customer-only concept.
router.get('/referral', protect, getMyReferral);
router.post('/referral/apply', protect, applyReferralCode);

module.exports = router;
