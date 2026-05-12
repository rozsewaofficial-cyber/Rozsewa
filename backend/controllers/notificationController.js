const Notification = require('../models/Notification');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { sendNotificationToUser } = require('../config/notificationService');

// @desc    Get user/provider notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (notification && notification.recipientId.toString() === req.user._id.toString()) {
            notification.isRead = true;
            await notification.save();
            res.json({ message: 'Notification marked as read' });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ recipientId: req.user._id, isRead: false }, { isRead: true });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (notification && notification.recipientId.toString() === req.user._id.toString()) {
            await notification.deleteOne();
            res.json({ message: 'Notification removed' });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveFCMToken = async (req, res) => {
    try {
        const { token, platform } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const userId = req.user._id;
        const userRole = req.user.role;

        let target;
        if (userRole === 'provider') {
            target = await Provider.findById(userId);
        } else {
            target = await User.findById(userId);
        }

        if (!target) return res.status(404).json({ message: 'User/Provider not found' });

        if (!target.fcmTokens) target.fcmTokens = [];
        if (!target.fcmTokenMobile) target.fcmTokenMobile = [];

        if (platform === 'mobile') {
            if (!target.fcmTokenMobile.includes(token)) {
                target.fcmTokenMobile.push(token);
                if (target.fcmTokenMobile.length > 10) target.fcmTokenMobile.shift();
            }
        } else {
            if (!target.fcmTokens.includes(token)) {
                target.fcmTokens.push(token);
                if (target.fcmTokens.length > 10) target.fcmTokens.shift();
            }
        }

        await target.save();

        // Send login notification
        try {
            await sendNotificationToUser(userId, userRole, {
                title: "Login Successful",
                body: "You have successfully logged in!",
                data: {
                    type: "login",
                    id: userId.toString(),
                    link: "/dashboard"
                }
            });
        } catch (err) {
            console.error("Error sending login notification:", err);
        }

        res.json({ message: 'Token saved successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const removeFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const userId = req.user._id;
        const userRole = req.user.role;

        let target;
        if (userRole === 'provider') {
            target = await Provider.findById(userId);
        } else {
            target = await User.findById(userId);
        }

        if (!target) return res.status(404).json({ message: 'User/Provider not found' });

        if (target.fcmTokens) {
            target.fcmTokens = target.fcmTokens.filter(t => t !== token);
        }
        if (target.fcmTokenMobile) {
            target.fcmTokenMobile = target.fcmTokenMobile.filter(t => t !== token);
        }

        await target.save();
        res.json({ message: 'Token removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const testFCMNotification = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        
        await sendNotificationToUser(userId, userRole, {
            title: "Test Notification",
            body: "This is a test push notification from Rozsewa!",
            data: {
                type: "test",
                id: "123",
                link: "/test"
            }
        });
        
        res.json({ message: 'Test notification sent' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    saveFCMToken,
    removeFCMToken,
    testFCMNotification
};
