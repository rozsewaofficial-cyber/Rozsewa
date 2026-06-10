const express = require('express');
const router = express.Router();
const {
    verifyBank,
    verifyPAN,
    verifyGST,
    initiateDigilocker
} = require('../controllers/verifyController');
const { protect } = require('../middleware/authMiddleware');

// Mount at /api/v1/verify
router.post('/bank', verifyBank);
router.post('/pan', verifyPAN);
router.post('/gst', verifyGST);

module.exports = router;
