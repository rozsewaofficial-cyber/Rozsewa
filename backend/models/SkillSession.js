const mongoose = require('mongoose');

const normalizeServiceKey = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const skillSessionSchema = mongoose.Schema({
    sewakId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

    serviceName: { type: String, required: true },
    // Provider.subServices holds NAMES, not ids — every certification lookup joins
    // on this normalized key. See D2 in SKILL_SESSION_PLAN.md.
    serviceKey: { type: String, required: true, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // reporting only

    mode: { type: String, enum: ['online', 'offline'], default: 'offline' },
    durationMinutes: { type: Number, default: 60 },

    // The only two inputs the Sewak gives.
    preferredDate: { type: String, default: '' },              // "YYYY-MM-DD"
    preferredTimeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening'], default: 'morning' },

    // Set by the allocator.
    scheduledDate: { type: String, default: '' },              // "YYYY-MM-DD"
    scheduledTime: { type: String, default: '' },              // "HH:mm"
    centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingCenter', default: null },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', default: null },

    status: {
        type: String,
        enum: ['pending', 'scheduled', 'completed', 'no_show', 'cancelled'],
        default: 'pending'
    },

    meetingLink: { type: String, default: '' },

    attendanceMarkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    attendanceMarkedAt: { type: Date, default: null },

    isReSession: { type: Boolean, default: false },
    parentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SkillSession', default: null },
    reSessionRound: { type: Number, default: 0 },

    remind1DaySent: { type: Boolean, default: false },
    remind2HourSent: { type: Boolean, default: false },

    allocationAttempts: { type: Number, default: 0 },
    cancelledAt: { type: Date, default: null }
}, {
    timestamps: true
});

skillSessionSchema.pre('validate', function () {
    if (this.serviceName && !this.serviceKey) {
        this.serviceKey = normalizeServiceKey(this.serviceName);
    }
});

skillSessionSchema.index({ sewakId: 1, status: 1 });
skillSessionSchema.index({ trainerId: 1, scheduledDate: 1, scheduledTime: 1 });
skillSessionSchema.index({ centerId: 1, scheduledDate: 1 });
skillSessionSchema.index({ status: 1, scheduledDate: 1 });                 // reminders + retry cron
skillSessionSchema.index({ sewakId: 1, categoryId: 1, serviceKey: 1 });    // certification lookup

const SkillSession = mongoose.model('SkillSession', skillSessionSchema);
SkillSession.normalizeServiceKey = normalizeServiceKey;

module.exports = SkillSession;
