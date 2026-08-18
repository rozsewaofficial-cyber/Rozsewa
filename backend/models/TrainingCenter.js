const mongoose = require('mongoose');

const availabilityWindowSchema = mongoose.Schema({
    day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], required: true },
    startTime: { type: String, default: '10:00' }, // 24h "HH:mm"
    endTime: { type: String, default: '18:00' }
}, { _id: false });

const normalizeCity = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const trainingCenterSchema = mongoose.Schema({
    name: { type: String, required: true, trim: true },
    cities: { type: [String], default: [] },
    // Maintained from `cities` on every save — allocation matches on this, because
    // Provider.city is raw geocoder output and never reliably equals a Zone name.
    citiesNormalized: { type: [String], default: [], index: true },
    address: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    capacity: { type: Number, default: 20 }, // seats per day across all trainers
    availability: { type: [availabilityWindowSchema], default: [] },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

trainingCenterSchema.pre('save', function () {
    if (this.isModified('cities')) {
        this.citiesNormalized = (this.cities || []).map(normalizeCity).filter(Boolean);
    }
});

// findOneAndUpdate / updateOne bypass the `save` hook, so mirror the sync here too.
trainingCenterSchema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate() || {};
    const cities = update.cities || (update.$set && update.$set.cities);
    if (cities) {
        const normalized = cities.map(normalizeCity).filter(Boolean);
        if (update.$set) update.$set.citiesNormalized = normalized;
        else update.citiesNormalized = normalized;
        this.setUpdate(update);
    }
});

trainingCenterSchema.index({ isActive: 1, categories: 1 });

module.exports = mongoose.model('TrainingCenter', trainingCenterSchema);
module.exports.normalizeCity = normalizeCity;
