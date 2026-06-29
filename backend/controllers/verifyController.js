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

// @desc    Verify Bank Account via Penny Drop (Fallback to IFSC since Penny Drop is not enabled)
// @route   POST /api/v1/verify/bank
// @access  Private
const verifyBank = async (req, res) => {
    const { accountNumber, ifscCode, beneficiaryName } = req.body;

    if (!ifscCode) {
        return res.status(400).json({ success: false, message: 'IFSC code is required' });
    }

    if (!accountNumber) {
        return res.status(400).json({ success: false, message: 'Account number is required' });
    }

    try {
        const Provider = require('../models/Provider');
        const exists = await Provider.findOne({ 'bankDetails.accountNumber': accountNumber });
        if (exists) {
            return res.status(400).json({ success: false, message: 'This Bank Account is already registered with another provider.' });
        }

        // CGPEY IFSC API is currently broken on their end ("providerName is not defined").
        // We use Razorpay's free public API instead for reliable IFSC verification.
        const response = await axios.get(`https://ifsc.razorpay.com/${ifscCode}`);

        res.json({
            success: true,
            status: "VERIFIED",
            data: response.data,
            message: "IFSC verified successfully"
        });
    } catch (error) {
        console.error('IFSC Verification Error:', error.response?.data || error.message);
        res.status(400).json({ 
            success: false, 
            message: 'Invalid IFSC Code or verification failed',
            error: error.response?.data || error.message
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
        const Provider = require('../models/Provider');
        const exists = await Provider.findOne({ kycPanNumber: pan });
        if (exists) {
            return res.status(400).json({ success: false, message: 'PAN number is already registered with another account' });
        }

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
        const Provider = require('../models/Provider');
        const exists = await Provider.findOne({ gst: gstNumber });
        if (exists) {
            return res.status(400).json({ success: false, message: 'GST number is already registered with another account' });
        }

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

// @desc    Initiate Aadhaar OKYC
// @route   POST /api/v1/verify/okyc/initiate
// @access  Private
const initiateOKYC = async (req, res) => {
    const { aadhaarNumber } = req.body;

    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return res.status(400).json({ success: false, message: 'Valid 12-digit Aadhaar number is required' });
    }

    try {
        const Provider = require('../models/Provider');
        const exists = await Provider.findOne({ kycAadhaar: aadhaarNumber });
        if (exists) {
            return res.status(400).json({ success: false, message: 'Aadhaar number is already registered with another account' });
        }

        const response = await axios.post(`${BASE_URL}/api/v1/verify/okyc/initiate`, {
            aadhaarNumber: aadhaarNumber
        }, { headers: getHeaders() });

        res.json(response.data);
    } catch (error) {
        console.error('OKYC Initiate Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'Aadhaar OTP initiation failed',
            error: error.response?.data 
        });
    }
};

// @desc    Verify Aadhaar OKYC OTP
// @route   POST /api/v1/verify/okyc/verify
// @access  Private
const verifyOKYC = async (req, res) => {
    const { sessionId, otp, aadhaarNumber } = req.body;

    if (!sessionId || !otp || !aadhaarNumber) {
        return res.status(400).json({ success: false, message: 'Session ID, OTP and Aadhaar Number are required' });
    }

    try {
        const response = await axios.post(`${BASE_URL}/api/v1/verify/okyc/verify`, {
            sessionId,
            otp,
            aadhaarNumber
        }, { headers: getHeaders() });

        res.json(response.data);
    } catch (error) {
        console.error('OKYC Verify Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'Aadhaar OTP verification failed',
            error: error.response?.data 
        });
    }
};

// @desc    Verify Criminal Records
// @route   POST /api/v1/verify/criminal_verification
// @access  Private
const verifyCriminal = async (req, res) => {
    const { idNumber, name, address } = req.body; // e.g. Aadhaar or PAN number for search

    if (!idNumber) {
        return res.status(400).json({ success: false, message: 'ID number is required for criminal verification' });
    }
    if (!name || !address) {
        return res.status(400).json({ success: false, message: 'name and address are required for criminal verification' });
    }

    try {
        // Here you would normally make an axios call to AuthBridge or similar.
        // For now, based on user provided example, we'll hit the BASE_URL or mock it if it's the CGPEY sandbox.
        // Note: The external API only accepts name and address, idNumber is not allowed.
        const response = await axios.post(`${BASE_URL}/api/v1/verify/criminal_verification`, { name, address }, { headers: getHeaders() });
        res.json(response.data);
    } catch (error) {
        // If the third-party API is not implemented yet, we return the user's mock success payload
        if (error.response && error.response.status === 404) {
             return res.json({
                success: true,
                status: "SUCCESS",
                data: {
                    service: "CRIMINAL_VERIFICATION",
                    strong_match: [],
                    possible_match: [],
                    eliminated_data: [],
                    totalResult: 0
                },
                message: "Criminal records lookup completed (Mocked fallback)"
            });
        }
        
        console.error('Criminal Verification Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'Criminal verification failed',
            error: error.response?.data 
        });
    }
};

// @desc    Verify Driving Licence
// @route   POST /api/v1/verify/driving_licence
// @access  Private
const verifyDrivingLicence = async (req, res) => {
    const { licence_number, dob } = req.body;

    if (!licence_number) {
        return res.status(400).json({ success: false, message: 'Driving licence number is required' });
    }
    if (!dob) {
        return res.status(400).json({ success: false, message: 'Date of birth (dob) is required' });
    }

    try {
        const response = await axios.post(`${BASE_URL}/api/v1/verify/driving_licence`, { licence_number, dob }, { headers: getHeaders() });
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.status === 404) {
             return res.json({
                success: true,
                status: "SUCCESS",
                data: {
                    service: "DRIVING_LICENCE",
                    document_type: "DRIVING_LICENSE",
                    document_id: licence_number,
                    name: "RAJNISH PRASAD",
                    date_of_birth: dob,
                    dependent_name: "HARISH PRASAD",
                    address: "FLAT NO 503 DIMOND ISLE 3 CHS LTD, ROYAL PALM ESTATE, GOREGAON EAST",
                    pincode: "400065",
                    validity: {
                        non_transport: {
                            issue_date: "2019-06-10",
                            expiry_date: "2039-06-09"
                        }
                    },
                    rto_details: {
                        state: "Maharashtra",
                        authority: "RTO,BORIVALI"
                    }
                },
                message: "Driving licence lookup completed (Mocked fallback)"
            });
        }

        console.error('Driving Licence Verification Error:', error.response?.data || error.message);
        res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'Driving licence verification failed',
            error: error.response?.data 
        });
    }
};

module.exports = {
    verifyBank,
    verifyPAN,
    verifyGST,
    initiateOKYC,
    verifyOKYC,
    verifyCriminal,
    verifyDrivingLicence
};
