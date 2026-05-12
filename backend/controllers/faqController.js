const FAQ = require('../models/FAQ');

// @desc    Get all FAQs
// @route   GET /api/faqs
// @access  Public
const getFAQs = async (req, res) => {
    try {
        const faqs = await FAQ.find({});
        res.json(faqs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a FAQ (Admin)
// @route   POST /api/faqs
// @access  Private/Admin
const createFAQ = async (req, res) => {
    const { question, answer, category } = req.body;
    try {
        const faq = new FAQ({ question, answer, category });
        const createdFaq = await faq.save();
        res.status(201).json(createdFaq);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a FAQ (Admin)
// @route   PUT /api/faqs/:id
// @access  Private/Admin
const updateFAQ = async (req, res) => {
    const { question, answer, category } = req.body;
    try {
        const faq = await FAQ.findById(req.params.id);
        if (faq) {
            faq.question = question || faq.question;
            faq.answer = answer || faq.answer;
            faq.category = category || faq.category;
            const updatedFaq = await faq.save();
            res.json(updatedFaq);
        } else {
            res.status(404).json({ message: 'FAQ not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a FAQ (Admin)
// @route   DELETE /api/faqs/:id
// @access  Private/Admin
const deleteFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findById(req.params.id);
        if (faq) {
            await faq.deleteOne();
            res.json({ message: 'FAQ removed' });
        } else {
            res.status(404).json({ message: 'FAQ not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ
};
