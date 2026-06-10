const express = require('express');
const router = express.Router();

// Mock PAN Verification
router.post('/api/v1/verify/pan', (req, res) => {
    res.json({
        success: true,
        status: "VERIFIED",
        data: {
            pan: req.body.pan,
            name: "JOHN DOE",
            fathersName: "ROBERT DOE",
            dob: "1990-01-01"
        }
    });
});

// Mock GST Verification
router.post('/api/v1/verify/gst', (req, res) => {
    res.json({
        success: true,
        status: "VERIFIED",
        data: {
            gstNumber: req.body.gstNumber,
            businessName: "SHARMA EXPERTS PVT LTD",
            status: "Active",
            address: "123 Business Park, New Delhi"
        }
    });
});

// Mock Bank Verification
router.post('/api/v1/verify/bank', (req, res) => {
    res.json({
        success: true,
        status: "VERIFIED",
        data: {
            accountNumber: req.body.accountNumber,
            ifscCode: req.body.ifscCode,
            accountHolderName: req.body.beneficiaryName || "JOHN DOE",
            pennyDropAmount: 1,
            pennyDropTransactionId: "TXN123456"
        }
    });
});

// Mock DigiLocker Initiate
router.post('/api/v1/digilocker/initiate', (req, res) => {
    res.json({
        success: true,
        status: "SUCCESS",
        message: "DigiLocker initiated successfully",
        data: {
            // Using a safe test URL instead of actual digilocker
            authUrl: "https://google.com?q=Digilocker+Auth+Simulation" 
        }
    });
});

module.exports = router;
