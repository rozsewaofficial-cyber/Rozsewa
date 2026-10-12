const express = require('express');
const router = express.Router();
const {
    getCatalog,
    getMyPaymentConfig,
    quoteOrder,
    createKitPaymentOrder,
    getMyOrders,
    getMyOrderById,
    getMyDues
} = require('../controllers/kitOrderController');
const { protect } = require('../middleware/authMiddleware');

router.get('/catalog', protect, getCatalog);
router.get('/payment-config', protect, getMyPaymentConfig);
router.post('/quote', protect, quoteOrder);
// The Razorpay payment for a kit order, priced by the server. The order itself
// is placed only by POST /payment/verify-kit-order, after the payment — the
// old POST /order placed one with no payment at all (a wallet debit, into the
// negative) and nothing in the app used it.
router.post('/payment-order', protect, createKitPaymentOrder);
router.get('/orders', protect, getMyOrders);
router.get('/dues', protect, getMyDues);
router.get('/training-status', protect, require('../controllers/trainingPanelController').getMyTrainingStatus);
router.get('/orders/:id', protect, getMyOrderById);

module.exports = router;
