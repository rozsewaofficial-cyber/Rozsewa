const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'senderModel'
    },
    senderModel: {
        type: String,
        required: true,
        enum: ['User', 'Provider']
    },
    text: {
        type: String,
        required: false
    },
    type: {
        type: String,
        enum: ['text', 'offer'],
        default: 'text'
    },
    offerAmount: {
        type: Number,
        required: function() {
            return this.type === 'offer';
        }
    },
    offerStatus: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
