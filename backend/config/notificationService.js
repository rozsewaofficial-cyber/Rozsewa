const admin = require('./firebase');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const Provider = require('../models/Provider');

async function sendNotificationToUser(userId, userRole, payload) {
    let notificationId = `${userId}_${payload.data?.type}_${payload.data?.id}`;

    // Make notificationId unique for login and test so we can insert the log without unique index crash
    if (payload.data?.type === 'test' || payload.data?.type === 'login') {
        notificationId += `_${Date.now()}`;
    } else {
        // 🚫 Prevent duplicate
        const exists = await NotificationLog.findOne({ notificationId });
        if (exists) {
            console.log(`Duplicate notification ignored: ${notificationId}`);
            return;
        }
    }

    // Find target (User or Provider)
    let target;
    if (userRole === 'provider') {
        target = await Provider.findById(userId);
    } else {
        target = await User.findById(userId);
    }

    if (!target) {
        console.log(`User/Provider not found for notification: ${userId}`);
        return;
    }

    let tokens = [...(target.fcmTokens || []), ...(target.fcmTokenMobile || [])];
    tokens = [...new Set(tokens)]; // Remove duplicates

    if (!tokens.length) {
        console.log(`No FCM tokens found for user: ${userId}`);
        return;
    }

    try {
        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: payload.title,
                body: payload.body
            },
            data: {
                ...payload.data,
                notificationId
            }
        });

        console.log(`Successfully sent ${response.successCount} notifications.`);

        // Save log (LOCK)
        await NotificationLog.create({
            notificationId,
            userId: userId.toString(),
            tokens
        });

        // Clean up failed tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log(`Failed tokens count: ${failedTokens.length}`);
            
            if (failedTokens.length > 0) {
                if (target.fcmTokens) target.fcmTokens = target.fcmTokens.filter(t => !failedTokens.includes(t));
                if (target.fcmTokenMobile) target.fcmTokenMobile = target.fcmTokenMobile.filter(t => !failedTokens.includes(t));
                await target.save();
                console.log(`Removed ${failedTokens.length} failed tokens from DB.`);
            }
        }
    } catch (error) {
        console.error('Error sending FCM notification:', error);
    }
}

/**
 * Unified notification handler:
 * 1. Saves to Database (Notification collection)
 * 2. Emits real-time via Socket.io
 * 3. Sends FCM Push Notification
 */
async function notifyUser({ userId, userRole, title, message, type = 'system', data = {}, bookingId = null }) {
    try {
        const Notification = require('../models/Notification');
        const { emitToUser, emitToProvider } = require('./socket');

        // 1. Create DB Record
        const notificationData = {
            recipientId: userId,
            recipientModel: userRole === 'provider' ? 'Provider' : 'User',
            title,
            message,
            type,
        };
        if (bookingId) notificationData.bookingId = bookingId;

        const newNotification = await Notification.create(notificationData);

        // 2. Emit Socket Event
        const socketPayload = {
            _id: newNotification._id,
            title,
            message,
            type,
            bookingId,
            createdAt: newNotification.createdAt,
            isRead: false,
            ...data
        };

        if (userRole === 'provider') {
            emitToProvider(userId, 'NEW_NOTIFICATION', socketPayload);
        } else {
            emitToUser(userId, 'NEW_NOTIFICATION', socketPayload);
        }

        // 3. Send FCM Push Notification
        await sendNotificationToUser(userId, userRole, {
            title,
            body: message,
            data: { type, bookingId: bookingId ? bookingId.toString() : '', ...data }
        });

        return newNotification;
    } catch (err) {
        console.error('Error in notifyUser:', err);
    }
}

module.exports = { sendNotificationToUser, notifyUser };
