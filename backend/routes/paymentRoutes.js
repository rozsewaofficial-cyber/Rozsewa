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
// Where Razorpay sends the browser after paying when the checkout cannot call
// back into the page (bank-page redirects, phone WebViews). No login: it is a
// form post from Razorpay; the signature and the recorded order are the proof.
router.post('/callback', express.urlencoded({ extended: false }), require('../controllers/paymentController').razorpayCallback);
router.post('/verify', verifyPayment);
router.post('/verify-subscription', protect, verifySubscriptionPayment);
router.post('/verify-wallet', protect, verifyWalletRecharge);
// Paid but never confirmed (app closed, network dropped): credited once here.
router.post('/wallet/reconcile', protect, require('../controllers/paymentController').reconcileWalletRecharges);
router.post('/verify-user-wallet', protect, verifyUserWalletRecharge);
router.post('/verify-lead-payment', protect, verifyLeadPayment);
router.post('/verify-bazaar', protect, verifyBazaarPayment);
router.post('/verify-kit-order', protect, require('../controllers/paymentController').verifyKitOrderPayment);

module.exports = router;
