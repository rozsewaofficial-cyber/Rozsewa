const axios = require('axios');

/**
 * Send OTP via SMSINDIAHUB
 * @param {string} mobile - Mobile number with country code (e.g., 91xxxxxxxxxx)
 * @param {string} otp - The 6-digit OTP
 */
const sendSMSOTP = async (mobile, otp) => {
    try {
        const apiKey = process.env.SMSINDIAHUB_API_KEY;
        const senderId = process.env.SMSINDIAHUB_SENDER_ID;
        const message = `Welcome to the Rozsewa powered by SMSINDIAHUB. Your OTP for registration is ${otp}`;

        // Sanitize mobile number (remove + or any spaces)
        const cleanMobile = mobile.replace(/\D/g, '');

        // Ensure strictly 10 digits or 12 digits (if 91 is included)
        // SMSINDIAHUB usually expects 91 prefix for Indian numbers
        const targetNumber = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

        // API Endpoint for SMSINDIAHUB (Standard Push SMS)
        // Note: Using the API Key based URL structure common for SMSINDIAHUB
        const url = `http://cloud.smsindiahub.in/vendorsms/pushsms.aspx?apikey=${apiKey}&msisdn=${targetNumber}&sid=${senderId}&msg=${encodeURIComponent(message)}&fl=0&gwid=2`;

        const response = await axios.get(url);

        console.log(`SMS Sent to ${targetNumber}. Response:`, response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Error sending SMS:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendSMSOTP };
