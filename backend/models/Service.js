const mongoose = require('mongoose');

const serviceSchema = mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Provider'
    },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: String, default: '30 min' },
    visible: { type: Boolean, default: true },
    image: { type: String },
    amenities: [{ type: String }],
    serviceDetails: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;
