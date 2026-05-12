const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    notificationId: { type: String, unique: true, required: true },
    userId: String,
    tokens: [String],
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // auto delete after 24h
    }
});

module.exports = mongoose.model('NotificationLog', schema);
