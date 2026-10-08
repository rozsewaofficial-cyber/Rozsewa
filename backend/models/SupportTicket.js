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
    // The conversation on this ticket (Live Chat). `reply` above is the
    // single answer admin could give before; it's kept for old tickets.
    messages: [{
        sender: { type: String, enum: ['provider', 'user', 'admin'], required: true },
        senderId: { type: mongoose.Schema.Types.ObjectId },
        senderName: { type: String },
        text: { type: String, required: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now }
    }],
    // A callback the ticket owner asked for (Request a Call).
    callRequest: {
        status: { type: String, enum: ['requested', 'in_progress', 'completed', 'cancelled'] },
        phone: { type: String },
        preferredTime: { type: String },
        note: { type: String, maxlength: 500 },
        requestedAt: { type: Date },
        updatedAt: { type: Date },
        handledBy: { type: String }
    },
    contactInfo: {
        name: { type: String, required: false },
        mobile: { type: String, required: false },
        email: { type: String, required: false },
        role: { type: String, enum: ['provider', 'sewak', 'customer'], required: false }
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

supportTicketSchema.index({ providerId: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
