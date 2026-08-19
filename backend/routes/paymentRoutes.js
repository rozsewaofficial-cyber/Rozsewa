const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, verifySubscriptionPayment, verifyWalletRecharge, verifyBazaarPayment, verifyUserWalletRecharge, verifyLeadPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/order', createOrder);
router.post('/verify', verifyPayment);
router.post('/verify-subscription', protect, verifySubscriptionPayment);
router.post('/verify-wallet', protect, verifyWalletRecharge);
router.post('/verify-user-wallet', protect, verifyUserWalletRecharge);
router.post('/verify-lead-payment', protect, verifyLeadPayment);
router.post('/verify-bazaar', protect, verifyBazaarPayment);
router.post('/verify-kit-order', protect, require('../controllers/paymentController').verifyKitOrderPayment);

module.exports = router;
