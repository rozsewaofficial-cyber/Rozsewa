const express = require('express');
const router = express.Router();
const {
    loginTrainer,
    getTrainerProfile,
    getMyAssignedSessions,
    markAttendanceAsTrainer,
    createReSessionAsTrainer
} = require('../controllers/trainerAuthController');
const { protectTrainer } = require('../middleware/authMiddleware');

router.post('/login', loginTrainer);
router.get('/me', protectTrainer, getTrainerProfile);
router.get('/sessions', protectTrainer, getMyAssignedSessions);
router.put('/sessions/:id/attendance', protectTrainer, markAttendanceAsTrainer);
router.post('/sessions/:id/re-session', protectTrainer, createReSessionAsTrainer);

module.exports = router;
