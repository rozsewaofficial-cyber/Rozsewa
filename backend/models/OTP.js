const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '5m' } // OTP expires in 5 minutes
    }
});

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
