const axios = require('axios');

// Configure your base URL and credentials in .env
const BASE_URL = process.env.VERIFY_API_BASE_URL || process.env.CGPEY_BASE_URL || 'https://api.thirdparty.com';
const MERCHANT_ID = process.env.VERIFY_MERCHANT_ID || process.env.CGPEY_MERCHANT_ID || '6a226d16b27283a7438b2f44';
const API_KEY = process.env.VERIFY_API_KEY || process.env.CGPEY_API_KEY || 'pk_a7e260f3f70602e79d2551b04389bf94';
const SECRET_KEY = process.env.VERIFY_SECRET_KEY || process.env.CGPEY_SECRET_KEY || '0949dfd379ce77ab141f9808569d0f451f0afc8b187ac653cb13b2c8965c3c27';

const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-merchant-id': MERCHANT_ID,
    'x-api-key': API_KEY,
    'x-secret-key': SECRET_KEY
});

// @desc    Verify Bank Account via Penny Drop
// @route   POST /api/v1/verify/bank
// @access  Private
const verifyBank = async (req, res) => {
    const { accountNumber, ifscCode, beneficiaryName } = req.body;

    if (!accountNumber || !ifscCode || !beneficiaryName) {
        return res.status(400).json({ success: false, message: 'Account number, IFSC code, and Beneficiary Name are required' });
    }

    try {
        // Using IFSC API as requested
        const response = await axios.post(`${BASE_URL}/api/v1/verify/ifsc`, {
            ifscCode
        }, { headers: getHeaders() });

        res.json(response.data);
    } catch (error) {
        console.error('IFSC Verification Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'IFSC verification failed',
            error: error.response?.data 
        });
    }
};

// @desc    Verify PAN
// @route   POST /api/v1/verify/pan
// @access  Private
const verifyPAN = async (req, res) => {
    const { pan } = req.body;

    if (!pan) {
        return res.status(400).json({ success: false, message: 'PAN is required' });
    }

    try {
        const response = await axios.post(`${BASE_URL}/api/v1/verify/pan`, { pan }, { headers: getHeaders() });
        res.json(response.data);
    } catch (error) {
        console.error('PAN Verification Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'PAN verification failed',
            error: error.response?.data 
        });
    }
};

// @desc    Verify GST
// @route   POST /api/v1/verify/gst
// @access  Private
const verifyGST = async (req, res) => {
    const { gstNumber } = req.body;

    if (!gstNumber) {
        return res.status(400).json({ success: false, message: 'GST number is required' });
    }

    try {
        const response = await axios.post(`${BASE_URL}/api/v1/verify/gst`, { gstNumber }, { headers: getHeaders() });
        res.json(response.data);
    } catch (error) {
        console.error('GST Verification Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'GST verification failed',
            error: error.response?.data 
        });
    }
};

// @desc    Initiate DigiLocker OAuth
// @route   POST /api/v1/digilocker/initiate
// @access  Private
const initiateDigilocker = async (req, res) => {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
        return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    try {
        const redirectUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/digilocker/callback` : 'http://localhost:5173/digilocker/callback';
        
        const response = await axios.post(`${BASE_URL}/api/v1/digilocker/initiate`, {
            mobileNumber,
            redirectUrl,
            consent: true,
            consentPurpose: "Merchant KYC Verification - Aadhaar",
            redirectToSignup: false,
            documentsForConsent: ["AADHAAR_XML"]
        }, { headers: getHeaders() });

        res.json(response.data);
    } catch (error) {
        console.error('DigiLocker Initiate Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'DigiLocker initiation failed',
            error: error.response?.data 
        });
    }
};

module.exports = {
    verifyBank,
    verifyPAN,
    verifyGST,
    initiateDigilocker
};
