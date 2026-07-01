const admin = require('./firebase');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const Provider = require('../models/Provider');

/**
 * Maps booking notification titles to dedicated Email and SMS templates
 */
const mapEventDetails = (title, type, booking, provider) => {
    let eventName = 'Notification';
    let emailSubject = '';
    let emailHtml = '';
    let smsText = '';

    const bookingRef = booking ? `#${booking._id.toString().slice(-6)}` : '';
    const serviceName = booking ? (booking.serviceName || 'Service') : 'Service';
    const dateStr = booking ? `${booking.bookingDate || 'N/A'} at ${booking.bookingTime || 'N/A'}` : 'N/A';
    const amountStr = booking ? `₹${booking.totalAmount || 0}` : '₹0';
    const addressStr = booking ? (booking.address || 'N/A') : 'N/A';
    const paymentStr = booking ? (booking.paymentMode === 'after' ? 'Cash on Delivery' : 'Online Payment') : 'N/A';

    const normalizedTitle = title ? title.toLowerCase() : '';

    if (normalizedTitle.includes('urgent') || normalizedTitle.includes('request') || normalizedTitle.includes('new request')) {
        eventName = 'Booking Created';
        emailSubject = `New Booking Request: ${serviceName} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #4CAF50; text-align: center;">New Booking Request Received!</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong> (${provider.shopName || 'Rozsewa Partner'}),</p>
                <p>You have received a new service request on RozSewa. Here are the details:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background-color: #f9f9f9;">
                        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Service</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${serviceName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Date & Time</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${dateStr}</td>
                    </tr>
                    <tr style="background-color: #f9f9f9;">
                        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Amount</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${amountStr}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Payment Mode</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${paymentStr}</td>
                    </tr>
                    <tr style="background-color: #f9f9f9;">
                        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Address</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${addressStr}</td>
                    </tr>
                </table>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/provider/bookings" style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Booking Request</a>
                </div>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Alert: New request for ${serviceName} on ${dateStr}. Amount: ${amountStr}. Address: ${addressStr}. Accept here: ${process.env.FRONTEND_URL || 'http://localhost:8080'}/provider/bookings`;
    } else if (normalizedTitle.includes('cancelled')) {
        eventName = 'Booking Cancelled';
        emailSubject = `Booking Cancelled: ${serviceName} ${bookingRef} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #f44336; text-align: center;">Booking Cancelled</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>The booking <strong>${bookingRef}</strong> for <strong>${serviceName}</strong> has been cancelled by the customer.</p>
                <p>Details:</p>
                <ul>
                    <li>Date/Time: ${dateStr}</li>
                </ul>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Alert: Booking ${bookingRef} for ${serviceName} has been cancelled by the customer.`;
    } else if (normalizedTitle.includes('accepted')) {
        eventName = 'Booking Accepted';
        emailSubject = `Booking Confirmed: ${serviceName} ${bookingRef} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #2196F3; text-align: center;">Booking Confirmed!</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>The booking <strong>${bookingRef}</strong> for <strong>${serviceName}</strong> is confirmed for <strong>${dateStr}</strong>.</p>
                <p>Details:</p>
                <ul>
                    <li>Amount: ${amountStr}</li>
                    <li>Address: ${addressStr}</li>
                </ul>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Confirm: Booking ${bookingRef} for ${serviceName} is confirmed for ${dateStr}. Amount: ${amountStr}. Address: ${addressStr}.`;
    } else if (normalizedTitle.includes('rejected')) {
        eventName = 'Booking Rejected';
        emailSubject = `Booking Offer/Schedule Rejected: ${serviceName} ${bookingRef} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #ff9800; text-align: center;">Offer/Schedule Proposal Rejected</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>The offer/schedule proposal for booking <strong>${bookingRef}</strong> (${serviceName}) was rejected.</p>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Alert: Offer/schedule proposal for booking ${bookingRef} (${serviceName}) was rejected.`;
    } else if (normalizedTitle.includes('schedule') || normalizedTitle.includes('rescheduled')) {
        eventName = 'Booking Rescheduled';
        emailSubject = `Schedule Update: ${serviceName} ${bookingRef} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #ff9800; text-align: center;">Schedule Update Proposed</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>A new schedule proposal has been submitted for booking <strong>${bookingRef}</strong> (${serviceName}): <strong>${dateStr}</strong>.</p>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Alert: Schedule for booking ${bookingRef} (${serviceName}) has been proposed/updated to ${dateStr}.`;
    } else if (normalizedTitle.includes('completed')) {
        eventName = 'Booking Completed';
        emailSubject = `Booking Completed: ${serviceName} ${bookingRef} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #4CAF50; text-align: center;">Service Completed ✓</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>Great job! The service <strong>${bookingRef}</strong> for <strong>${serviceName}</strong> has been marked completed.</p>
                <p>Details:</p>
                <ul>
                    <li>Total Amount Collected: ${amountStr}</li>
                </ul>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Success: Booking ${bookingRef} for ${serviceName} was completed. Thank you!`;
    } else if (normalizedTitle.includes('payment') || normalizedTitle.includes('paid')) {
        eventName = 'Payment Received';
        emailSubject = `Payment Received: ${serviceName} ${bookingRef} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #4CAF50; text-align: center;">Payment Confirmed</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>Payment of <strong>${amountStr}</strong> for booking <strong>${bookingRef}</strong> (${serviceName}) has been successfully received.</p>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa: Payment of ${amountStr} received for booking ${bookingRef} (${serviceName}).`;
    } else {
        eventName = 'Booking Update';
        emailSubject = `Booking Update: ${title} - RozSewa`;
        emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #2196F3; text-align: center;">Booking Update</h2>
                <p>Hello <strong>${provider.ownerName || 'Partner'}</strong>,</p>
                <p>There is an update on booking <strong>${bookingRef}</strong>: ${title}.</p>
                <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message from RozSewa. Please do not reply directly to this email.</p>
            </div>
        `;
        smsText = `RozSewa Update: ${title} for booking ${bookingRef}.`;
    }

    return { eventName, emailSubject, emailHtml, smsText };
};

/**
 * Send FCM push notification (direct or called via notifyUser)
 */
async function sendNotificationToUser(userId, userRole, payload, bypassDuplicateCheck = false) {
    const titleKey = payload.title ? payload.title.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const idKey = payload.data?.bookingId || payload.data?.id || 'default';
    const typeKey = payload.data?.type || 'system';

    let notificationId = `${userId}_${typeKey}_${idKey}_${titleKey}`;

    // Make notificationId unique for login, test, or system alerts
    if (typeKey === 'test' || typeKey === 'login' || typeKey === 'system') {
        notificationId += `_${Date.now()}`;
    }

    if (!bypassDuplicateCheck && typeKey !== 'test' && typeKey !== 'login' && typeKey !== 'system') {
        // 🚫 Prevent duplicate on direct FCM pushes
        const exists = await NotificationLog.findOne({ notificationId });
        if (exists) {
            console.log(`Duplicate notification ignored (FCM direct call): ${notificationId}`);
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
        // FCM requires all data values to be strings
        const stringifiedData = {};
        if (payload.data) {
            for (const key in payload.data) {
                if (payload.data[key] !== undefined && payload.data[key] !== null) {
                    stringifiedData[key] = String(payload.data[key]);
                }
            }
        }
        stringifiedData.userRole = String(userRole);
        stringifiedData.notificationId = String(notificationId);

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: payload.title || 'New Notification',
                body: payload.body || ''
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default'
                }
            },
            apns: {
                headers: {
                    'apns-priority': '10'
                },
                payload: {
                    aps: {
                        sound: 'default',
                        'content-available': 1
                    }
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: '/RozSewa.png'
                }
            },
            data: stringifiedData
        });

        console.log(`Successfully sent ${response.successCount} push notifications.`);

        // Save log (LOCK) - use findOneAndUpdate to prevent duplicate key errors
        await NotificationLog.findOneAndUpdate(
            { notificationId },
            { userId: userId.toString(), tokens },
            { upsert: true, new: true }
        );

        // Clean up failed tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const err = resp.error;
                    console.error(`FCM token delivery failed for token [${tokens[idx].substring(0, 15)}...]: Code=${err?.code}, Message=${err?.message}`);
                    // Only remove if it is a permanent invalid/unregistered token error
                    if (err?.code === 'messaging/registration-token-not-registered' || err?.code === 'messaging/invalid-argument') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });
            console.log(`Failed tokens to remove: ${failedTokens.length}`);
            
            if (failedTokens.length > 0) {
                if (target.fcmTokens) target.fcmTokens = target.fcmTokens.filter(t => !failedTokens.includes(t));
                if (target.fcmTokenMobile) target.fcmTokenMobile = target.fcmTokenMobile.filter(t => !failedTokens.includes(t));
                await target.save();
                console.log(`Removed ${failedTokens.length} permanently failed/unregistered tokens from DB.`);
            }
        }
    } catch (error) {
        console.error('Error sending FCM notification:', error);
    }
}

/**
 * Unified notification handler (In-App DB, Socket, FCM, Email, SMS)
 */
async function notifyUser({ userId, userRole, title, message, type = 'system', data = {}, bookingId = null }) {
    const timestamp = new Date().toISOString();
    let inAppStatus = 'skipped';
    let socketStatus = 'skipped';
    let pushStatus = 'skipped';
    let emailStatus = 'skipped';
    let smsStatus = 'skipped';
    let errorMessage = null;
    let errorStack = null;
    let hasErrors = false;

    try {
        const Notification = require('../models/Notification');
        const { emitToUser, emitToProvider } = require('./socket');

        const titleKey = title ? title.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const idKey = bookingId ? bookingId.toString() : (data?.bookingId || data?.leadId || data?.id || 'default');
        const eventKey = `${userId}_${type}_${idKey}_${titleKey}`;

        // 1. Atomic Duplicate Prevention using findOneAndUpdate + upsert
        if (type !== 'test' && type !== 'login' && type !== 'system') {
            const existingLog = await NotificationLog.findOneAndUpdate(
                { notificationId: eventKey },
                { $setOnInsert: { userId: userId.toString(), createdAt: new Date() } },
                { upsert: true, new: false } // Returns pre-upsert document
            );

            if (existingLog) {
                console.log(`[Duplicate Prevention] Already processed (atomic check): ${eventKey}`);
                return null; // Return null to make function fully idempotent
            }
        }

        // 2. Channel 1: In-App Notification (Database Record)
        let newNotification;
        try {
            const notificationData = {
                recipientId: userId,
                recipientModel: userRole === 'provider' ? 'Provider' : 'User',
                title,
                message,
                type,
            };
            if (bookingId) notificationData.bookingId = bookingId;
            if (data?.leadId) notificationData.leadId = data.leadId;

            newNotification = await Notification.create(notificationData);
            inAppStatus = 'success';
        } catch (dbErr) {
            inAppStatus = 'fail';
            hasErrors = true;
            errorMessage = dbErr.message;
            errorStack = dbErr.stack;
            console.error('[Notification Channel Error] In-App Notification failed:', dbErr);
        }

        // 3. Channel 2: Socket.io Emit
        try {
            const socketPayload = {
                _id: newNotification ? newNotification._id : undefined,
                title,
                message,
                type,
                bookingId,
                leadId: data?.leadId,
                createdAt: newNotification ? newNotification.createdAt : new Date(),
                isRead: false,
                ...data
            };

            if (userRole === 'provider') {
                emitToProvider(userId, 'NEW_NOTIFICATION', socketPayload);
            } else {
                emitToUser(userId, 'NEW_NOTIFICATION', socketPayload);
            }
            socketStatus = 'success';
        } catch (sockErr) {
            socketStatus = 'fail';
            hasErrors = true;
            errorMessage = sockErr.message;
            errorStack = sockErr.stack;
            console.error('[Notification Channel Error] Socket emit failed:', sockErr);
        }

        // 4. Channel 3: Firebase Push Notification (FCM)
        try {
            await sendNotificationToUser(userId, userRole, {
                title,
                body: message,
                data: { type, bookingId: bookingId ? bookingId.toString() : '', ...data }
            }, true); // bypassDuplicateCheck = true
            pushStatus = 'success';
        } catch (fcmErr) {
            pushStatus = 'fail';
            hasErrors = true;
            errorMessage = fcmErr.message;
            errorStack = fcmErr.stack;
            console.error('[Notification Channel Error] FCM Push failed:', fcmErr);
        }

        // 5. Channels 4 & 5: Email & SMS/WhatsApp (Provider booking/payment events only)
        if (userRole === 'provider' && (type === 'booking' || type === 'payment') && bookingId) {
            try {
                const Provider = require('../models/Provider');
                const Booking = require('../models/Booking');
                const provider = await Provider.findById(userId);
                const booking = await Booking.findById(bookingId);

                if (provider && booking) {
                    // Validate booking schema payload and log warnings for missing fields
                    const missingFields = [];
                    if (!booking._id) missingFields.push('bookingId');
                    if (!booking.serviceName) missingFields.push('serviceName');
                    if (!booking.bookingDate) missingFields.push('bookingDate');
                    if (!booking.bookingTime) missingFields.push('bookingTime');
                    if (booking.totalAmount === undefined || booking.totalAmount === null) missingFields.push('totalAmount');
                    if (!booking.paymentMode) missingFields.push('paymentMode');
                    if (!booking.address) missingFields.push('address');

                    if (missingFields.length > 0) {
                        console.warn(`[Notification Validation Warning] Booking #${bookingId} is missing fields: ${missingFields.join(', ')}`);
                    }

                    // Map title to email / SMS template
                    const { emailSubject, emailHtml, smsText } = mapEventDetails(title, type, booking, provider);

                    // Send Email
                    if (provider.email) {
                        try {
                            const { sendEmail } = require('../utils/emailService');
                            const emailRes = await sendEmail(provider.email, emailSubject, emailHtml);
                            if (emailRes && emailRes.success) {
                                emailStatus = 'success';
                            } else {
                                const classification = emailRes?.error && (emailRes.error.includes('550') || emailRes.error.includes('553') || emailRes.error.includes('Invalid recipient')) 
                                    ? 'Permanent Failure' 
                                    : 'Transient Failure';
                                emailStatus = `fail [${classification}: ${emailRes?.error || 'Unknown Error'}]`;
                                hasErrors = true;
                                errorMessage = emailRes?.error || 'SMTP failed';
                            }
                        } catch (emailErr) {
                            const classification = (emailErr.message && (emailErr.message.includes('550') || emailErr.message.includes('553') || emailErr.message.includes('Invalid recipient')))
                                ? 'Permanent Failure'
                                : 'Transient Failure';
                            emailStatus = `fail [${classification}: ${emailErr.message}]`;
                            hasErrors = true;
                            errorMessage = emailErr.message;
                            errorStack = emailErr.stack;
                            console.error('[Notification Channel Error] SMTP Email failed:', emailErr);
                        }
                    } else {
                        emailStatus = 'skipped (no email address)';
                    }

                    // Send SMS
                    if (provider.mobile) {
                        try {
                            const cleanMobile = provider.mobile.replace(/\D/g, '');
                            const isDummy = !cleanMobile || cleanMobile.length < 10 || /^0+$/.test(cleanMobile) || /^1+$/.test(cleanMobile) || cleanMobile === '1234567890';
                            
                            if (isDummy) {
                                smsStatus = 'fail [Permanent Failure: Invalid/Dummy phone number]';
                                hasErrors = true;
                                errorMessage = 'Invalid phone number format';
                            } else {
                                const { sendSMSMessage } = require('../utils/smsService');
                                const smsRes = await sendSMSMessage(provider.mobile, smsText);
                                if (smsRes && smsRes.success) {
                                    smsStatus = 'success';
                                } else {
                                    smsStatus = `fail [Transient Failure: ${smsRes?.error || 'API Error'}]`;
                                    hasErrors = true;
                                    errorMessage = smsRes?.error || 'SMS Gateway failed';
                                }
                            }
                        } catch (smsErr) {
                            const clean = provider.mobile.replace(/\D/g, '');
                            const isDummy = !clean || clean.length < 10 || /^0+$/.test(clean) || /^1+$/.test(clean) || clean === '1234567890';
                            const classification = isDummy ? 'Permanent Failure' : 'Transient Failure';
                            smsStatus = `fail [${classification}: ${smsErr.message}]`;
                            hasErrors = true;
                            errorMessage = smsErr.message;
                            errorStack = smsErr.stack;
                            console.error('[Notification Channel Error] SMS send failed:', smsErr);
                        }
                    } else {
                        smsStatus = 'skipped (no mobile number)';
                    }
                } else {
                    console.error(`[Notification Data Error] Provider or Booking details not found for IDs: Provider=${userId}, Booking=${bookingId}`);
                }
            } catch (fetchErr) {
                hasErrors = true;
                errorMessage = fetchErr.message;
                errorStack = fetchErr.stack;
                console.error('[Notification Data Fetch Error] Failed to fetch Provider/Booking details:', fetchErr);
            }
        }

        // 6. Structured Logging Output
        const logObject = {
            timestamp,
            bookingId: bookingId ? bookingId.toString() : null,
            providerId: userRole === 'provider' ? userId.toString() : null,
            customerId: userRole === 'user' ? userId.toString() : null,
            notificationType: type,
            eventName: titleKey || 'default_event',
            channelStatus: {
                inApp: inAppStatus,
                socket: socketStatus,
                push: pushStatus,
                email: emailStatus,
                sms: smsStatus
            }
        };

        if (hasErrors) {
            logObject.errorMessage = errorMessage;
            logObject.errorStack = errorStack;
        }

        console.log('[Notification Attempt Summary]', JSON.stringify(logObject, null, 2));

        return newNotification;
    } catch (parentErr) {
        // Decouple Booking Flow: Never propagate errors or crash the parent flow
        console.error('[Notification Parent Fatal Error] notifyUser failed silently:', parentErr);
        return null;
    }
}

module.exports = { sendNotificationToUser, notifyUser };
