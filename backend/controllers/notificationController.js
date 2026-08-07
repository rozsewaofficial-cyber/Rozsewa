const Notification = require('../models/Notification');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { notifyUser } = require('../config/notificationService');

// @desc    Get user/provider notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            recipientId: req.user._id,
            title: { $ne: null, $exists: true, $ne: "", $ne: "null" },
            message: { $ne: null, $exists: true, $ne: "", $ne: "null" }
        })
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user/provider unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ 
            recipientId: req.user._id, 
            isRead: false,
            title: { $ne: null, $exists: true, $ne: "", $ne: "null" },
            message: { $ne: null, $exists: true, $ne: "", $ne: "null" }
        });
        res.json({ unreadCount: count });
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

const clearAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ recipientId: req.user._id });
        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveFCMToken = async (req, res) => {
    try {
        const { token, platform } = req.body;
        console.log(`[saveFCMToken API] Received token request: platform="${platform}", tokenLength=${token ? token.length : 0}, userId=${req.user?._id}`);
        
        if (!token) {
            console.log(`[saveFCMToken API] Error: Token is required (platform: ${platform})`);
            return res.status(400).json({ message: 'Token is required' });
        }

        const userId = req.user._id;
        const userRole = req.user.role;

        const isMobile = (platform === 'mobile' || platform === 'app' || platform === 'android' || platform === 'ios');
        
        const updateQuery = {};
        if (isMobile) {
            updateQuery.$addToSet = { fcmTokenMobile: token };
        } else {
            updateQuery.$addToSet = { fcmTokens: token };
        }

        if (userRole === 'provider') {
            await Provider.findByIdAndUpdate(userId, updateQuery);
        } else {
            await User.findByIdAndUpdate(userId, updateQuery);
        }

        console.log(`[saveFCMToken API] Successfully updated tokens for ${userId}`);

        // Removed the annoying "Login Successful" push notification here per user request

        res.json({ message: 'Token saved successfully' });
    } catch (error) {
        console.error('[saveFCMToken API] Fatal Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const removeFCMToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required' });

        const userId = req.user._id;
        const userRole = req.user.role;

        const updateQuery = {
            $pull: {
                fcmTokens: token,
                fcmTokenMobile: token
            }
        };

        if (userRole === 'provider') {
            await Provider.findByIdAndUpdate(userId, updateQuery);
        } else {
            await User.findByIdAndUpdate(userId, updateQuery);
        }

        res.json({ message: 'Token removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const testFCMNotification = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;

        // Use the unified notifyUser pipeline (not the raw FCM-only sender) so the
        // test entry is also persisted to the DB and pushed over the socket —
        // otherwise it only ever shows as an OS-level push and never appears in
        // the in-app notification bell/list on the partner side.
        await notifyUser({
            userId,
            userRole,
            title: "Test Notification",
            message: "This is a test notification from Rozsewa. If you can see this, notifications are working correctly!",
            type: "test",
            data: {
                link: userRole === 'provider' ? '/provider/notifications' : '/notifications'
            }
        });

        res.json({ message: 'Test notification sent' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    saveFCMToken,
    removeFCMToken,
    testFCMNotification
};
