const Guide = require('../models/Guide');

// @desc    Get all active guides
// @route   GET /api/guides
// @access  Public (Provider/Admin)
exports.getGuides = async (req, res) => {
    try {
        const guides = await Guide.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json(guides);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching guides', error: error.message });
    }
};

// @desc    Get a single guide by ID
// @route   GET /api/guides/:id
// @access  Public
exports.getGuideById = async (req, res) => {
    try {
        const guide = await Guide.findById(req.params.id);
        if (!guide) return res.status(404).json({ message: 'Guide not found' });
        res.status(200).json(guide);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Create a new guide
// @route   POST /api/guides
// @access  Admin
exports.createGuide = async (req, res) => {
    try {
        const count = await Guide.countDocuments();
        if (count >= 3) {
            return res.status(400).json({ message: 'Maximum limit of 3 guides reached. Please edit or delete existing guides.' });
        }

        const { title, category, readTime, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ message: 'Title and content are required' });
        }
        
        const guide = new Guide({ title, category, readTime, content });
        await guide.save();
        res.status(201).json(guide);
    } catch (error) {
        res.status(500).json({ message: 'Server error creating guide', error: error.message });
    }
};

// @desc    Update a guide
// @route   PUT /api/guides/:id
// @access  Admin
exports.updateGuide = async (req, res) => {
    try {
        const { title, category, readTime, content, isActive } = req.body;
        const guide = await Guide.findById(req.params.id);
        
        if (!guide) return res.status(404).json({ message: 'Guide not found' });

        guide.title = title || guide.title;
        guide.category = category || guide.category;
        guide.readTime = readTime || guide.readTime;
        guide.content = content || guide.content;
        if (isActive !== undefined) guide.isActive = isActive;

        await guide.save();
        res.status(200).json(guide);
    } catch (error) {
        res.status(500).json({ message: 'Server error updating guide', error: error.message });
    }
};

// @desc    Delete a guide
// @route   DELETE /api/guides/:id
// @access  Admin
exports.deleteGuide = async (req, res) => {
    try {
        const guide = await Guide.findById(req.params.id);
        if (!guide) return res.status(404).json({ message: 'Guide not found' });

        await guide.deleteOne();
        res.status(200).json({ message: 'Guide removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting guide', error: error.message });
    }
};
