const express = require('express');
const router = express.Router();
const {
    getCatalog,
    getMyPaymentConfig,
    quoteOrder,
    placeOrder,
    getMyOrders,
    getMyOrderById,
    getMyDues
} = require('../controllers/kitOrderController');
const { protect } = require('../middleware/authMiddleware');

router.get('/catalog', protect, getCatalog);
router.get('/payment-config', protect, getMyPaymentConfig);
router.post('/quote', protect, quoteOrder);
router.post('/order', protect, placeOrder);
router.get('/orders', protect, getMyOrders);
router.get('/dues', protect, getMyDues);
router.get('/training-status', protect, require('../controllers/trainingPanelController').getMyTrainingStatus);
router.get('/orders/:id', protect, getMyOrderById);

module.exports = router;
