const express = require('express');
const router = express.Router();
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, saveFCMToken, removeFCMToken, testFCMNotification } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.patch('/read-all', protect, markAllAsRead);
router.patch('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);
router.delete('/', protect, clearAllNotifications);

// FCM Token routes
router.post('/fcm-tokens/save', protect, saveFCMToken);
router.delete('/fcm-tokens/remove', protect, removeFCMToken);
router.post('/fcm-tokens/test', protect, testFCMNotification);

module.exports = router;
