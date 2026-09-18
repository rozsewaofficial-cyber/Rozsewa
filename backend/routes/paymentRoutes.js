const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, verifySubscriptionPayment, verifyWalletRecharge, verifyBazaarPayment, verifyUserWalletRecharge, verifyLeadPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Provider registration raises an order before there is an account, so this
// cannot demand a session. It does read one when it is offered, so the order
// can be stamped with whose it is and later refuse to be claimed by anyone
// else.
const noteWhoIfSignedIn = (req, res, next) =>
    req.headers.authorization ? protect(req, res, (err) => err ? next(err) : next()) : next();

router.post('/order', noteWhoIfSignedIn, createOrder);
router.post('/verify', verifyPayment);
router.post('/verify-subscription', protect, verifySubscriptionPayment);
router.post('/verify-wallet', protect, verifyWalletRecharge);
router.post('/verify-user-wallet', protect, verifyUserWalletRecharge);
router.post('/verify-lead-payment', protect, verifyLeadPayment);
router.post('/verify-bazaar', protect, verifyBazaarPayment);
router.post('/verify-kit-order', protect, require('../controllers/paymentController').verifyKitOrderPayment);

module.exports = router;
