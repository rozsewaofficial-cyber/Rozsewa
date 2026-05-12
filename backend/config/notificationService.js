const admin = require('./firebase');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const Provider = require('../models/Provider');

async function sendNotificationToUser(userId, userRole, payload) {
    const notificationId = `${userId}_${payload.data?.type}_${payload.data?.id}`;

    // 🚫 Prevent duplicate (Skip for test and login to allow multiple tests/login alerts)
    if (payload.data?.type !== 'test' && payload.data?.type !== 'login') {
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

module.exports = { sendNotificationToUser };
