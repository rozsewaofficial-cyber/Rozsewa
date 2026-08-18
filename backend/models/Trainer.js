const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const availabilityWindowSchema = mongoose.Schema({
    day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], required: true },
    startTime: { type: String, default: '10:00' }, // 24h "HH:mm"
    endTime: { type: String, default: '18:00' }
}, { _id: false });

const trainerSchema = mongoose.Schema({
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, unique: true },
    password: { type: String, required: true },
    trainingCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingCenter', required: true },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    availability: { type: [availabilityWindowSchema], default: [] },
    capacity: { type: Number, default: 5 }, // seats per slot
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

trainerSchema.index({ isActive: 1, trainingCenter: 1, categories: 1 });

trainerSchema.methods.matchPassword = async function (entered) {
    return await bcrypt.compare(entered, this.password);
};

trainerSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('Trainer', trainerSchema);
