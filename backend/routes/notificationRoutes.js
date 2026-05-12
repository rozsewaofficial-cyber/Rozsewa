const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, deleteNotification, saveFCMToken, removeFCMToken, testFCMNotification } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.patch('/read-all', protect, markAllAsRead);
router.patch('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);

// FCM Token routes
router.post('/fcm-tokens/save', protect, saveFCMToken);
router.delete('/fcm-tokens/remove', protect, removeFCMToken);
router.post('/fcm-tokens/test', protect, testFCMNotification);

module.exports = router;
