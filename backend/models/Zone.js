const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Zone name is required'],
        trim: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['Tier 1 Metro', 'Tier 1 Premium', 'Tier 2 City', 'New Market'],
        default: 'Tier 1 Metro'
    },
    activeProviders: {
        type: Number,
        default: 0
    },
    location: {
        lat: { type: Number, required: true, default: 28.6139 }, // Default Delhi
        lng: { type: Number, required: true, default: 77.2090 }
    },
    // PIN codes served in this city. While no active zone lists any, addresses
    // are not restricted; once one does, only listed PIN codes are accepted.
    pincodes: {
        type: [String],
        default: []
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const Zone = mongoose.model('Zone', zoneSchema);
module.exports = Zone;
