const mongoose = require('mongoose');

// ─── Validation Rule Sub-Schema ──────────────────────────────────────────────
const validationSchema = {
    minLength:        { type: Number, default: null },
    maxLength:        { type: Number, default: null },
    minValue:         { type: Number, default: null },
    maxValue:         { type: Number, default: null },
    regex:            { type: String, default: null },
    dateRangeFrom:    { type: Date,   default: null },
    dateRangeTo:      { type: Date,   default: null },
    maxFileSize:      { type: Number, default: null }, // bytes
    maxFileCount:     { type: Number, default: null },
    allowedFileTypes: { type: [String], default: [] }, // e.g. ['image/jpeg','application/pdf']
    conditionalRequired: {
        dependsOnFieldId: { type: String, default: null },
        dependsOnValue:   { type: mongoose.Schema.Types.Mixed, default: null }
    }
};

// ─── Visibility Rule Sub-Schema ───────────────────────────────────────────────
const visibilityRuleSchema = {
    _id: false,
    dependsOnFieldId: { type: String, required: true },
    operator: {
        type: String,
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'gt', 'lt', 'gte', 'lte', 'is_empty', 'is_not_empty'],
        required: true
    },
    value:  { type: mongoose.Schema.Types.Mixed, default: null },
    action: { type: String, enum: ['show', 'hide'], default: 'show' }
};

// ─── Field Option Sub-Schema ──────────────────────────────────────────────────
const fieldOptionSchema = {
    _id:   false,
    label: { type: String, required: true },
    value: { type: String, required: true }
};

// ─── Field Sub-Schema ─────────────────────────────────────────────────────────
const fieldSchema = {
    _id:  false,
    id:   { type: String, required: true }, // stable uuid — does NOT change across edits
    label:       { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: [
            'text', 'textarea', 'number', 'currency',
            'dropdown', 'multi_select', 'radio', 'checkbox',
            'boolean', 'date', 'time', 'datetime',
            'file', 'image', 'gps', 'email', 'phone', 'url'
        ]
    },
    placeholder:  { type: String, default: '' },
    helpText:     { type: String, default: '' },
    required:     { type: Boolean, default: false },
    sortOrder:    { type: Number, default: 0 },
    defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },

    // For dropdown / radio / checkbox / multi_select
    options: { type: [fieldOptionSchema], default: [] },

    // Validation rules (all optional)
    validation: {
        _id: false,
        ...validationSchema
    },

    // Conditional visibility rules (array — all rules evaluated)
    visibilityRules: { type: [visibilityRuleSchema], default: [] }
};

// ─── Section Sub-Schema ───────────────────────────────────────────────────────
const sectionSchema = {
    _id:         false,
    id:          { type: String, required: true }, // stable uuid
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    order:       { type: Number, default: 0 },
    isRepeatable:{ type: Boolean, default: false }, // "Add Another" support
    maxRepeat:   { type: Number, default: 5 },       // max repeat count
    fields:      { type: [fieldSchema], default: [] }
};

// ─── LeadForm Schema ──────────────────────────────────────────────────────────
const leadFormSchema = new mongoose.Schema({
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        index: true
    },
    // null = form applies to the entire category
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        default: null,
        index: true
    },
    title:       { type: String, required: true },
    description: { type: String, default: '' },

    // Version is incremented every time the form is published
    version:     { type: Number, default: 1 },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },

    // Soft-delete
    isArchived:  { type: Boolean, default: false },

    // Embedded sections (contain fields)
    sections: { type: [sectionSchema], default: [] },

    // Admin who last modified
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// Only one published form per category+service combination
leadFormSchema.index({ categoryId: 1, serviceId: 1, isPublished: 1 });
leadFormSchema.index({ createdAt: -1 });

const LeadForm = mongoose.model('LeadForm', leadFormSchema);
module.exports = LeadForm;
