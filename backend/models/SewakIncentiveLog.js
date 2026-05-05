const mongoose = require('mongoose');

const sewakIncentiveLogSchema = new mongoose.Schema({
    sewakId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    date: {
        type: String, // Normalized date string YYYY-MM-DD
        required: true
    },
    dailyBookingCount: {
        type: Number,
        required: true
    },
    bonusEarned: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast daily lookups
sewakIncentiveLogSchema.index({ sewakId: 1, date: 1 });

module.exports = mongoose.model('SewakIncentiveLog', sewakIncentiveLogSchema);
