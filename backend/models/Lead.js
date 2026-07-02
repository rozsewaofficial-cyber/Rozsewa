const mongoose = require('mongoose');

// ─── Attachment Sub-Schema ────────────────────────────────────────────────────
const attachmentSchema = {
    _id:        false,
    id:         { type: String, required: true }, // client-generated uuid
    url:        { type: String, required: true },
    thumbnail:  { type: String, default: null },
    mimeType:   { type: String, default: '' },
    size:       { type: Number, default: 0 },      // bytes
    fileName:   { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now }
};

// ─── Dynamic Answer Sub-Schema ────────────────────────────────────────────────
const dynamicAnswerSchema = {
    _id:       false,
    fieldId:   { type: String, required: true },
    label:     { type: String, default: '' },
    fieldType: { type: String, default: 'text' },
    value:     { type: mongoose.Schema.Types.Mixed, default: null }
};

// ─── Location Detail Sub-Schema ───────────────────────────────────────────────
const locationDetailSchema = {
    _id:       false,
    houseNo:   { type: String, default: '' },
    apartment: { type: String, default: '' },
    street:    { type: String, default: '' },
    landmark:  { type: String, default: '' },
    area:      { type: String, default: '' },
    city:      { type: String, default: '' },
    state:     { type: String, default: '' },
    pincode:   { type: String, default: '' }
};

// ─── Lead Schema ──────────────────────────────────────────────────────────────
const leadSchema = new mongoose.Schema({

    // ── Core Identity ──────────────────────────────────────────────────────────
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ID-based service references (rename-safe)
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        index: true
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null
    },
    subServiceId: {
        type: String,       // sub-service key or name stored as string for flexibility
        default: null
    },

    // Legacy field kept for backward compat with existing documents
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    service: { type: String, default: null },

    // ── Form Versioning ────────────────────────────────────────────────────────
    formId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LeadForm',
        default: null
    },
    formVersion: { type: Number, default: null },

    // ── Requirement ───────────────────────────────────────────────────────────
    requirementTitle: { type: String, default: '' },    // min 10 chars (validated in controller)
    requirementDesc:  { type: String, default: '' },    // min 30 chars (validated in controller)

    // Typed dynamic answers from form schema
    dynamicAnswers: { type: [dynamicAnswerSchema], default: [] },

    // Legacy flat form kept for backward compat
    requirementForm: {
        description:   { type: String, default: '' },
        preferredDate: { type: String, default: '' },
        preferredTime: { type: String, default: '' },
        images:        [{ type: String }],
        address:       { type: String, default: '' }
    },

    // ── Schedule ──────────────────────────────────────────────────────────────
    preferredDate:  { type: String, default: '' },
    preferredTime:  { type: String, default: '' },
    isDateFlexible: { type: Boolean, default: false },
    isTimeFlexible: { type: Boolean, default: false },

    // ── Location ──────────────────────────────────────────────────────────────
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],  // [longitude, latitude]
            required: true,
            default: [0, 0]
        }
    },
    locationDetail: { type: locationDetailSchema, default: () => ({}) },

    // ── Attachments (max 10) ──────────────────────────────────────────────────
    attachments: { type: [attachmentSchema], default: [] },

    // ── Business Model ────────────────────────────────────────────────────────
    businessModel: {
        type: String,
        enum: ['lead'],
        default: 'lead'
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    leadPrice:     { type: Number, default: 0 },
    maxUnlockLimit:{ type: Number, default: 3 },

    // ── Provider Tracking ─────────────────────────────────────────────────────
    nearbyProviders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    }],
    unlockedProviders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    }],
    viewedProviders: [{  // tracks which providers viewed this lead (for analytics)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    }],

    // ── Full 9-Status Lifecycle ───────────────────────────────────────────────
    status: {
        type: String,
        enum: [
            'draft',              // Customer started but not submitted
            'available',          // Submitted, no unlocks yet
            'partially_unlocked', // At least 1 unlock, below max
            'fully_unlocked',     // Reached maxUnlockLimit
            'expired',            // Expiry date passed
            'cancelled',          // Customer cancelled
            'disputed',           // Provider raised a dispute
            'refunded',           // Dispute approved, credits/wallet returned
            'closed'              // Admin force-closed or naturally completed
        ],
        default: 'draft',
        index: true
    },

    // ── Edit Lock ─────────────────────────────────────────────────────────────
    // Automatically set to true when the first provider unlocks the lead
    isEditLocked: { type: Boolean, default: false },

    // ── Dispute ───────────────────────────────────────────────────────────────
    disputeStatus: {
        type: String,
        enum: ['none', 'pending', 'refunded', 'rejected'],
        default: 'none'
    },

    // ── Expiry ────────────────────────────────────────────────────────────────
    expiry: { type: Date, required: true }

}, {
    timestamps: true
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
leadSchema.index({ location: '2dsphere' });
leadSchema.index({ categoryId: 1, status: 1 });
leadSchema.index({ category: 1, status: 1 });   // legacy compat
leadSchema.index({ customer: 1, createdAt: -1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ expiry: 1 });
leadSchema.index({ formId: 1 });

const Lead = mongoose.model('Lead', leadSchema);
module.exports = Lead;
