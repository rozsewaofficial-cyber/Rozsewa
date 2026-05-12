const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    issueType: {
        type: String,
        required: true,
        enum: ["Service Quality", "Wrong Charges", "Provider Behaviour", "Incomplete Work", "Damage Caused", "Other"]
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in-review', 'resolved'],
        default: 'open'
    },
    adminNotes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
