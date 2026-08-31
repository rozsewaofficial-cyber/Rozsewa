const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
    channel: {
        type: String,
        enum: ['notification', 'whatsapp'],
        required: true
    },
    title: { type: String }, // notification only
    message: { type: String, required: true },
    targetType: {
        type: String,
        enum: ['all', 'all_customers', 'all_partners', 'all_sewaks', 'specific'],
        required: true
    },
    recipientCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failCount: { type: Number, default: 0 },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Broadcast', broadcastSchema);
