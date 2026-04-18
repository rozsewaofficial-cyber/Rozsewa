const mongoose = require('mongoose');

const comboSchema = mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Provider'
    },
    name: { type: String, required: true },
    description: { type: String },
    services: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service'
        }
    ],
    price: { type: Number, required: true },
    image: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const Combo = mongoose.model('Combo', comboSchema);
module.exports = Combo;
