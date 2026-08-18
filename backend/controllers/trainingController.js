const mongoose = require('mongoose');
const TrainingCenter = require('../models/TrainingCenter');
const Trainer = require('../models/Trainer');
const SkillSession = require('../models/SkillSession');

// ── Training Centers ─────────────────────────────────────────────────────────

// @desc    List training centers
// @route   GET /api/admin/training-centers
// @access  Private/Admin
const getTrainingCenters = async (req, res) => {
    try {
        const query = {};
        if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';
        if (req.query.city) query.citiesNormalized = req.query.city.trim().toLowerCase();

        const centers = await TrainingCenter.find(query)
            .populate('categories', 'name icon')
            .sort({ name: 1 })
            .lean();

        // Trainer counts make the list actionable without a second request.
        const counts = await Trainer.aggregate([
            { $match: { trainingCenter: { $in: centers.map(c => c._id) } } },
            { $group: { _id: '$trainingCenter', n: { $sum: 1 } } }
        ]);
        const countMap = new Map(counts.map(c => [String(c._id), c.n]));

        res.json(centers.map(c => ({ ...c, trainerCount: countMap.get(String(c._id)) || 0 })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create training center
// @route   POST /api/admin/training-centers
// @access  Private/Admin
const createTrainingCenter = async (req, res) => {
    try {
        const { name, cities, address, contactNumber, categories, capacity, availability, isActive } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Center name is required' });
        }
        if (!Array.isArray(cities) || cities.length === 0) {
            return res.status(400).json({ message: 'At least one city is required' });
        }
        if (!Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({ message: 'At least one category is required' });
        }

        const center = new TrainingCenter({
            name: name.trim(),
            cities,
            address: address || '',
            contactNumber: contactNumber || '',
            categories,
            capacity: Number(capacity) > 0 ? Number(capacity) : 20,
            availability: availability || [],
            isActive: isActive !== undefined ? isActive : true
        });
        await center.save();
        res.status(201).json(center);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update training center
// @route   PUT /api/admin/training-centers/:id
// @access  Private/Admin
const updateTrainingCenter = async (req, res) => {
    try {
        const center = await TrainingCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ message: 'Training center not found' });

        const { name, cities, address, contactNumber, categories, capacity, availability, isActive } = req.body;
        if (name !== undefined) center.name = name.trim();
        if (cities !== undefined) center.cities = cities;
        if (address !== undefined) center.address = address;
        if (contactNumber !== undefined) center.contactNumber = contactNumber;
        if (categories !== undefined) center.categories = categories;
        if (capacity !== undefined) center.capacity = Number(capacity) > 0 ? Number(capacity) : center.capacity;
        if (availability !== undefined) center.availability = availability;
        if (isActive !== undefined) center.isActive = isActive;

        // `cities` is only re-normalized when Mongoose sees it as modified.
        if (cities !== undefined) center.markModified('cities');

        const updated = await center.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete training center
// @route   DELETE /api/admin/training-centers/:id
// @access  Private/Admin
const deleteTrainingCenter = async (req, res) => {
    try {
        const center = await TrainingCenter.findById(req.params.id);
        if (!center) return res.status(404).json({ message: 'Training center not found' });

        // Refuse rather than orphan live sessions — deactivating is the safe path.
        const live = await SkillSession.countDocuments({
            centerId: center._id,
            status: { $in: ['pending', 'scheduled'] }
        });
        if (live > 0) {
            return res.status(400).json({
                message: `${live} active session(s) are assigned to this center. Deactivate it instead, or reassign them first.`
            });
        }

        const trainerCount = await Trainer.countDocuments({ trainingCenter: center._id });
        if (trainerCount > 0) {
            return res.status(400).json({
                message: `${trainerCount} trainer(s) belong to this center. Remove or reassign them first.`
            });
        }

        await center.deleteOne();
        res.json({ message: 'Training center removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Trainers ─────────────────────────────────────────────────────────────────

// @desc    List trainers
// @route   GET /api/admin/trainers
// @access  Private/Admin
const getTrainers = async (req, res) => {
    try {
        const query = {};
        if (req.query.centerId && mongoose.Types.ObjectId.isValid(req.query.centerId)) {
            query.trainingCenter = req.query.centerId;
        }
        if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

        const trainers = await Trainer.find(query)
            .populate('trainingCenter', 'name cities')
            .populate('categories', 'name icon')
            .sort({ name: 1 })
            .lean();

        res.json(trainers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create trainer
// @route   POST /api/admin/trainers
// @access  Private/Admin
const createTrainer = async (req, res) => {
    try {
        const { name, mobile, trainingCenter, categories, availability, capacity, isActive } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'Trainer name is required' });
        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
        }
        if (!trainingCenter || !mongoose.Types.ObjectId.isValid(trainingCenter)) {
            return res.status(400).json({ message: 'A training center is required' });
        }

        const center = await TrainingCenter.findById(trainingCenter);
        if (!center) return res.status(404).json({ message: 'Training center not found' });

        // A trainer can only teach what their center offers.
        const centerCats = center.categories.map(String);
        const invalid = (categories || []).filter(c => !centerCats.includes(String(c)));
        if (invalid.length) {
            return res.status(400).json({ message: 'Trainer categories must be offered by their training center' });
        }

        const trainer = await Trainer.create({
            name: name.trim(),
            mobile,
            trainingCenter,
            categories: categories || [],
            availability: availability || [],
            capacity: Number(capacity) > 0 ? Number(capacity) : 5,
            isActive: isActive !== undefined ? isActive : true
        });
        res.status(201).json(trainer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update trainer
// @route   PUT /api/admin/trainers/:id
// @access  Private/Admin
const updateTrainer = async (req, res) => {
    try {
        const trainer = await Trainer.findById(req.params.id);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

        const { name, mobile, trainingCenter, categories, availability, capacity, isActive } = req.body;

        if (mobile !== undefined && !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
        }

        const targetCenterId = trainingCenter || trainer.trainingCenter;
        if (categories !== undefined) {
            const center = await TrainingCenter.findById(targetCenterId);
            if (!center) return res.status(404).json({ message: 'Training center not found' });
            const centerCats = center.categories.map(String);
            const invalid = categories.filter(c => !centerCats.includes(String(c)));
            if (invalid.length) {
                return res.status(400).json({ message: 'Trainer categories must be offered by their training center' });
            }
        }

        if (name !== undefined) trainer.name = name.trim();
        if (mobile !== undefined) trainer.mobile = mobile;
        if (trainingCenter !== undefined) trainer.trainingCenter = trainingCenter;
        if (categories !== undefined) trainer.categories = categories;
        if (availability !== undefined) trainer.availability = availability;
        if (capacity !== undefined) trainer.capacity = Number(capacity) > 0 ? Number(capacity) : trainer.capacity;
        if (isActive !== undefined) trainer.isActive = isActive;

        const updated = await trainer.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete trainer
// @route   DELETE /api/admin/trainers/:id
// @access  Private/Admin
const deleteTrainer = async (req, res) => {
    try {
        const trainer = await Trainer.findById(req.params.id);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

        const live = await SkillSession.countDocuments({
            trainerId: trainer._id,
            status: { $in: ['pending', 'scheduled'] }
        });
        if (live > 0) {
            return res.status(400).json({
                message: `${live} active session(s) are assigned to this trainer. Deactivate them instead, or reassign the sessions first.`
            });
        }

        await trainer.deleteOne();
        res.json({ message: 'Trainer removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getTrainingCenters,
    createTrainingCenter,
    updateTrainingCenter,
    deleteTrainingCenter,
    getTrainers,
    createTrainer,
    updateTrainer,
    deleteTrainer
};
