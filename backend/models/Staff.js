const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }, // e.g. Electrician, Barber
    status: { type: String, enum: ['Active', 'On Leave'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
