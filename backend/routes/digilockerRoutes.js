const express = require('express');
const router = express.Router();
const { initiateDigilocker } = require('../controllers/verifyController');
const { protect } = require('../middleware/authMiddleware');

// Mount at /api/v1/digilocker
router.post('/initiate', initiateDigilocker);

module.exports = router;
