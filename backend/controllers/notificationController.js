const Notification = require('../models/Notification');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { sendNotificationToUser } = require('../config/notificationService');

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

        let target;
        if (userRole === 'provider') {
            target = await Provider.findById(userId);
        } else {
            target = await User.findById(userId);
        }

        if (!target) {
            console.log(`[saveFCMToken API] Error: User/Provider not found for userId: ${userId}`);
            return res.status(404).json({ message: 'User/Provider not found' });
        }

        if (!target.fcmTokens) target.fcmTokens = [];
        if (!target.fcmTokenMobile) target.fcmTokenMobile = [];

        let isNewToken = false;

        if (platform === 'mobile' || platform === 'app') {
            if (!target.fcmTokenMobile.includes(token)) {
                target.fcmTokenMobile.push(token);
                if (target.fcmTokenMobile.length > 10) target.fcmTokenMobile.shift();
                isNewToken = true;
                console.log(`[saveFCMToken API] Saved Mobile/App Token for ${target.ownerName || target.name} (Total mobile tokens: ${target.fcmTokenMobile.length})`);
            } else {
                console.log(`[saveFCMToken API] Token already exists in fcmTokenMobile for ${target.ownerName || target.name}`);
            }
        } else {
            if (!target.fcmTokens.includes(token)) {
                target.fcmTokens.push(token);
                if (target.fcmTokens.length > 10) target.fcmTokens.shift();
                isNewToken = true;
                console.log(`[saveFCMToken API] Saved Web Token for ${target.ownerName || target.name} (Total web tokens: ${target.fcmTokens.length})`);
            } else {
                console.log(`[saveFCMToken API] Token already exists in fcmTokens (web) for ${target.ownerName || target.name}`);
            }
        }

        // Remove any duplicates that might have leaked in previously
        target.fcmTokens = [...new Set(target.fcmTokens)];
        target.fcmTokenMobile = [...new Set(target.fcmTokenMobile)];

        await target.save();

        // Send login notification ONLY ONCE per new device
        if (isNewToken) {
            try {
                await sendNotificationToUser(userId, userRole, {
                    title: "Login Successful",
                    body: "You have successfully logged in on a new device!",
                    data: {
                        type: "login",
                        id: userId.toString(),
                        link: "/dashboard"
                    }
                });
            } catch (err) {
                console.error("Error sending login notification:", err);
            }
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
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    saveFCMToken,
    removeFCMToken,
    testFCMNotification
};
