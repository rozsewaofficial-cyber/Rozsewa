const mongoose = require('mongoose');

const notificationSchema = mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'recipientModel' },
    recipientModel: { type: String, required: true, enum: ['User', 'Provider'] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['booking', 'cancel', 'sos', 'payment', 'system', 'offer', 'scrap', 'bazaar', 'lead', 'skill_session', 'kit_order', 'training', 'test', 'login', 'broadcast'], default: 'system' },
    isRead: { type: Boolean, default: false },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    // Where tapping it opens (e.g. the booking's offer), when it is more
    // specific than its type.
    link: { type: String },
    scrapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scrap' },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
