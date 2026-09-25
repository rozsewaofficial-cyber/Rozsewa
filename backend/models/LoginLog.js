const mongoose = require('mongoose');

/**
 * One row per successful admin-panel login (admin, superadmin, supervisor,
 * field_staff, employee — never a customer or provider, whose sign-ins are
 * not what "System Login Report" audits). city is a snapshot of the
 * account's own registered city at login time, not a live IP lookup —
 * there is no geolocation service wired into this app.
 */
const loginLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    city: { type: String, default: '' },
    ipAddress: { type: String, default: '' }
}, {
    timestamps: true // createdAt doubles as the login timestamp
});

loginLogSchema.index({ createdAt: -1 });
loginLogSchema.index({ city: 1, createdAt: -1 });

module.exports = mongoose.model('LoginLog', loginLogSchema);
