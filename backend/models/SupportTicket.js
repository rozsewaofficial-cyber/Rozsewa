const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: false,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    subject: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        enum: ['payment', 'booking', 'profile', 'app_issue', 'other'],
        default: 'other',
    },
    status: {
        type: String,
        enum: ['pending', 'open', 'resolved', 'closed'],
        default: 'pending',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low',
    },
    reply: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
