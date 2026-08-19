const mongoose = require('mongoose');

/**
 * One item the Sewak must physically have in hand.
 *
 * Snapshotted from StarterKitItem when the record is created — so adding a new
 * mandatory item to a category later cannot retroactively knock already-live
 * Sewaks offline. See TRAINING_PANEL_PLAN.md D8.
 */
const itemVerificationSchema = mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StarterKitItem' },
    itemName: { type: String },
    requiredQty: { type: Number, default: 1 },
    isMandatory: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verifiedByModel: { type: String, enum: ['User', 'Trainer', null], default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { _id: false });

const topicSchema = mongoose.Schema({
    key: { type: String, required: true },
    label: { type: String, required: true },
    covered: { type: Boolean, default: false },
    coveredAt: { type: Date, default: null }
}, { _id: false });

const historySchema = mongoose.Schema({
    action: { type: String, required: true },
    byModel: { type: String, enum: ['User', 'Trainer', 'System'], default: 'System' },
    by: { type: mongoose.Schema.Types.ObjectId, default: null },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' }
}, { _id: false });

const trainingRecordSchema = mongoose.Schema({
    sewakId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true,
        unique: true
    },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },

    status: {
        type: String,
        enum: ['pending', 'in_progress', 'on_hold_item_missing', 'training_done'],
        default: 'pending'
    },

    itemVerifications: { type: [itemVerificationSchema], default: [] },
    trainingTopics: { type: [topicSchema], default: [] },

    trainingCompleted: { type: Boolean, default: false },
    completedByModel: { type: String, enum: ['User', 'Trainer', null], default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    completedAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },

    holdReason: { type: String, default: '' },
    reopenedCount: { type: Number, default: 0 },

    history: { type: [historySchema], default: [] }
}, {
    timestamps: true
});

trainingRecordSchema.index({ status: 1, updatedAt: -1 });   // admin work queue

/** All mandatory items ticked? An empty mandatory list counts as satisfied. */
trainingRecordSchema.methods.allMandatoryVerified = function () {
    return (this.itemVerifications || [])
        .filter(i => i.isMandatory)
        .every(i => i.verified);
};

trainingRecordSchema.methods.missingMandatory = function () {
    return (this.itemVerifications || [])
        .filter(i => i.isMandatory && !i.verified)
        .map(i => i.itemName);
};

trainingRecordSchema.methods.allTopicsCovered = function () {
    const topics = this.trainingTopics || [];
    return topics.length > 0 && topics.every(t => t.covered);
};

module.exports = mongoose.model('TrainingRecord', trainingRecordSchema);
