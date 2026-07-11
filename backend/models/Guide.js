const mongoose = require('mongoose');

const GuideSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true,
        default: 'General'
    },
    readTime: {
        type: String,
        trim: true,
        default: '3 min read'
    },
    content: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Guide', GuideSchema);
