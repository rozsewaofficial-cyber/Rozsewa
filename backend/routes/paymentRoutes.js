const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, verifySubscriptionPayment, verifyWalletRecharge } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/order', createOrder);
router.post('/verify', verifyPayment);
router.post('/verify-subscription', protect, verifySubscriptionPayment);
router.post('/verify-wallet', protect, verifyWalletRecharge);

module.exports = router;
