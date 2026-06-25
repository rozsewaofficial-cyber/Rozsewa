const express = require('express');
const router = express.Router();
const {
    verifyBank,
    verifyPAN,
    verifyGST,
    initiateOKYC,
    verifyOKYC
} = require('../controllers/verifyController');
const { protect } = require('../middleware/authMiddleware');

// Mount at /api/v1/verify
router.post('/bank', verifyBank);
router.post('/pan', verifyPAN);
router.post('/gst', verifyGST);
router.post('/okyc/initiate', initiateOKYC);
router.post('/okyc/verify', verifyOKYC);

module.exports = router;
