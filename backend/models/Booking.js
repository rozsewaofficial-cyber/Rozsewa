const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: false,
    },
    serviceName: {
        type: String,
        required: true,
    },
    serviceId: {
        type: String,
        required: true,
    },
    bookingDate: {
        type: String,
        required: true,
    },
    bookingTime: {
        type: String,
        required: true,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'on_the_way', 'started', 'completed', 'cancelled'],
        default: 'pending',
    },
    startOTP: {
        type: String,
        default: null
    },
    endOTP: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending',
    },
    address: {
        type: String,
        required: true,
    },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number], // [longitude, latitude]
    },
    rating: {
        type: Number,
        default: 0,
    },
    comment: {
        type: String,
        default: '',
    },
    tags: {
        type: [String],
        default: [],
    },
    couponCode: {
        type: String,
        default: ''
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    paymentMode: {
        type: String,
        enum: ['now', 'after'],
        default: 'now'
    },
    beforeImage: { type: String, default: null },
    afterImage: { type: String, default: null },
    extraCharges: [
        {
            item: { type: String },
            amount: { type: Number }
        }
    ],
    extraStatus: {
        type: String,
        enum: ['none', 'pending', 'approved', 'declined'],
        default: 'none'
    },
    adminCommission: { type: Number, default: 0 },
    providerPayout: { type: Number, default: 0 },
    employeeCommission: { type: Number, default: 0 },
    commissionStatus: { type: String, enum: ['free', 'commissioned'], default: 'free' },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
