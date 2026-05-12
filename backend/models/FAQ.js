const mongoose = require('mongoose');

const faqSchema = mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'General' },
}, {
    timestamps: true
});

const FAQ = mongoose.model('FAQ', faqSchema);
module.exports = FAQ;
