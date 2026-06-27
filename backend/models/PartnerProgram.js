const mongoose = require('mongoose');

const partnerProgramSchema = new mongoose.Schema({
    ruleVersion: { type: Number, default: 1 },
    freeTrialEnabled: { type: Boolean, default: true },
    freeServiceCount: { type: Number, default: 3 },
    applyTo: { type: String, enum: ['all', 'selected'], default: 'all' },
    selectedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    trialStarts: { type: String, default: 'immediately_after_approval' },
    trialEnds: { type: String, default: 'exhausted' }
}, { timestamps: true });

module.exports = mongoose.model('PartnerProgram', partnerProgramSchema);
