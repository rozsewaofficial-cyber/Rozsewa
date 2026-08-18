const Trainer = require('../models/Trainer');
const SkillSession = require('../models/SkillSession');
const generateToken = require('../utils/generateToken');
const {
    markAttendanceCore,
    createReSessionCore
} = require('./skillSessionController');

// @desc    Trainer login
// @route   POST /api/trainer/login
// @access  Public
const loginTrainer = async (req, res) => {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
        return res.status(400).json({ message: 'Mobile number and password are required' });
    }

    try {
        const trainer = await Trainer.findOne({ mobile })
            .populate('trainingCenter', 'name address contactNumber cities')
            .populate('categories', 'name icon');
        if (!trainer) {
            return res.status(404).json({ message: 'No trainer account found with this mobile number' });
        }
        if (!trainer.isActive) {
            return res.status(403).json({ message: 'This trainer account has been deactivated. Contact admin.' });
        }
        if (!(await trainer.matchPassword(password))) {
            return res.status(401).json({ message: 'Incorrect password' });
        }

        const obj = trainer.toObject();
        delete obj.password;
        res.json({ ...obj, token: generateToken(trainer._id) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Trainer's own profile
// @route   GET /api/trainer/me
// @access  Private/Trainer
const getTrainerProfile = async (req, res) => {
    res.json(req.trainer);
};

// @desc    Sessions assigned to the logged-in trainer
// @route   GET /api/trainer/sessions
// @access  Private/Trainer
const getMyAssignedSessions = async (req, res) => {
    try {
        const { status } = req.query;
        const query = { trainerId: req.trainer._id };
        if (status) query.status = status;

        const sessions = await SkillSession.find(query)
            .populate('sewakId', 'ownerName mobile city vendorCode')
            .populate('categoryId', 'name icon')
            .sort({ scheduledDate: 1, scheduledTime: 1 })
            .lean();

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark attendance on one of the trainer's own sessions
// @route   PUT /api/trainer/sessions/:id/attendance
// @access  Private/Trainer
const markAttendanceAsTrainer = async (req, res) => {
    try {
        const { attendance } = req.body;
        if (!['present', 'no_show'].includes(attendance)) {
            return res.status(400).json({ message: "Attendance must be 'present' or 'no_show'" });
        }

        const session = await SkillSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (String(session.trainerId) !== String(req.trainer._id)) {
            return res.status(403).json({ message: 'This session is not assigned to you' });
        }
        if (session.status !== 'scheduled') {
            return res.status(400).json({ message: `Attendance can only be marked on a scheduled session (this one is ${session.status})` });
        }

        const populated = await markAttendanceCore(session, attendance, req.trainer._id);
        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Trainer-initiated re-session for one of their own sessions
// @route   POST /api/trainer/sessions/:id/re-session
// @access  Private/Trainer
const createReSessionAsTrainer = async (req, res) => {
    try {
        const parent = await SkillSession.findById(req.params.id);
        if (!parent) return res.status(404).json({ message: 'Session not found' });
        if (String(parent.trainerId) !== String(req.trainer._id)) {
            return res.status(403).json({ message: 'This session is not assigned to you' });
        }
        if (!['completed', 'no_show'].includes(parent.status)) {
            return res.status(400).json({ message: 'Only a completed or missed session can be repeated' });
        }

        const populated = await createReSessionCore(parent, req.body);
        res.status(201).json(populated);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

module.exports = {
    loginTrainer,
    getTrainerProfile,
    getMyAssignedSessions,
    markAttendanceAsTrainer,
    createReSessionAsTrainer
};
