const axios = require('axios');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://appapi.technovicsolutions.com/api/send';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;

/** Technovic Solutions expects country code + number with no separators and no '+' (e.g. 919876543210) */
const formatIndianMobile = (mobile) => {
    if (!mobile) return null;
    const digits = String(mobile).replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return digits;
};

/**
 * Core sender. Never throws — booking flows must not fail because WhatsApp is down.
 */
const sendWhatsAppMessage = async (mobile, message) => {
    const number = formatIndianMobile(mobile);
    if (!number) {
        console.log('[WhatsApp] Skipped — no valid recipient mobile number');
        return { success: false, error: 'Invalid mobile number' };
    }
    if (!WHATSAPP_API_KEY) {
        console.log('[WhatsApp] Skipped — WHATSAPP_API_KEY not configured');
        return { success: false, error: 'WhatsApp API not configured' };
    }

    try {
        await axios.post(WHATSAPP_API_URL, {
            number,
            type: 'text',
            message
        }, {
            headers: {
                'X-Access-Token': WHATSAPP_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        return { success: true };
    } catch (error) {
        const errMsg = error.response?.data?.message || error.message;
        console.error('[WhatsApp] Send failed:', errMsg);
        return { success: false, error: errMsg };
    }
};

/**
 * Which in-app notifications are also sent on WhatsApp, and to whom.
 *
 * Partners get every job, lead and booking alert. A customer's booking
 * messages are already sent by the booking flow itself (confirmed, on the way,
 * started, completed, cancelled), so for a customer only what that flow does
 * not cover is sent here: an Insta Work job has no booking behind it.
 * Reminders (several per booking) stay on push only.
 */
const PARTNER_TYPES = new Set(['booking', 'booking_update', 'cancel', 'lead']);
const CUSTOMER_TYPES = new Set(['booking', 'booking_update', 'lead']);

const alertWanted = ({ userRole, type, title, bookingId }) => {
    if (String(process.env.WHATSAPP_ALERTS || '').toLowerCase() === 'off') return false;
    if (/^reminder:/i.test(String(title || ''))) return false;
    if (userRole === 'provider') return PARTNER_TYPES.has(type);
    // A customer notification that carries a booking is the booking flow's own.
    if (CUSTOMER_TYPES.has(type)) return !bookingId || type === 'lead';
    return false;
};

const looksDummy = (digits) => digits.length < 10 || /^0+$/.test(digits) || /^1+$/.test(digits) || digits === '1234567890';

/**
 * Send an in-app notification on WhatsApp too. Never throws; resolves to a
 * short status for the notification log.
 */
const sendAlert = async ({ userId, userRole, title, message, type, bookingId }) => {
    if (!alertWanted({ userRole, type, title, bookingId })) return 'skipped (not a WhatsApp alert)';
    if (!WHATSAPP_API_KEY) return 'skipped (not configured)';
    try {
        const Model = userRole === 'provider' ? require('../models/Provider') : require('../models/User');
        const who = await Model.findById(userId).select('mobile').lean();
        const digits = String(who?.mobile || '').replace(/\D/g, '');
        if (!digits || looksDummy(digits)) return 'skipped (no valid mobile)';
        const site = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
        const link = site ? `\n\nOpen the app: ${site}` : '';
        const res = await sendWhatsAppMessage(digits, `*${title}*\n${message}${link}\n\n- Team RozSewa`);
        return res.success ? 'success' : `fail (${res.error})`;
    } catch (err) {
        return `fail (${err.message})`;
    }
};

const bookingRef = (booking) => booking._id.toString().slice(-6).toUpperCase();

const STATUS_COPY = {
    on_the_way: { emoji: '🚗', label: 'Partner is on the way' },
    started: { emoji: '🔧', label: 'Service has started' },
    completed: { emoji: '✅', label: 'Service completed' },
    cancelled: { emoji: '❌', label: 'Booking cancelled' }
};

const sendBookingConfirmed = async (user, booking) => {
    const content = `✅ *Booking Confirmed!*\n\n` +
        `Hi ${user.name || 'there'}, your booking #${bookingRef(booking)} for *${booking.serviceName}* has been confirmed by a partner.\n\n` +
        `📅 ${booking.bookingDate || ''} ${booking.bookingTime || ''}\n` +
        `💰 Amount: ₹${booking.totalAmount || 0}\n` +
        `📍 ${booking.address || 'N/A'}\n\n` +
        `Track your booking live on the RozSewa app.\n\n- Team RozSewa`;
    return sendWhatsAppMessage(user.mobile, content);
};

const sendBookingStatusUpdate = async (user, booking, status) => {
    const info = STATUS_COPY[status];
    if (!info) return { success: false, error: `Unsupported status: ${status}` };
    const content = `${info.emoji} *${info.label}*\n\n` +
        `Booking #${bookingRef(booking)} for *${booking.serviceName}* is now: *${info.label}*.\n\n` +
        `Track it live on the RozSewa app.\n\n- Team RozSewa`;
    return sendWhatsAppMessage(user.mobile, content);
};

const sendInvoice = async (user, booking) => {
    const lines = [
        '🧾 *Invoice — RozSewa*',
        '',
        `Booking #: ${bookingRef(booking)}`,
        `Service: ${booking.serviceName}`,
        `Date: ${booking.bookingDate || ''} ${booking.bookingTime || ''}`,
        `Address: ${booking.address || 'N/A'}`,
        '',
        `Amount: ₹${booking.totalAmount || 0}`,
        `Payment Mode: ${booking.paymentMode === 'after' ? 'Cash' : 'Online'}`,
        `Payment Status: ${booking.paymentStatus === 'paid' ? 'Paid' : 'Pending'}`,
        '',
        'Thank you for choosing RozSewa!'
    ];
    return sendWhatsAppMessage(user.mobile, lines.join('\n'));
};

const sendReviewRequest = async (user, booking) => {
    const link = `${process.env.FRONTEND_URL || 'https://rozsewa.in'}/service-history`;
    const content = `⭐ *How was your service?*\n\n` +
        `Hi ${user.name || 'there'}, your booking #${bookingRef(booking)} for *${booking.serviceName}* is complete.\n\n` +
        `Please rate your experience: ${link}\n\n` +
        `Your feedback helps us improve!\n\n- Team RozSewa`;
    return sendWhatsAppMessage(user.mobile, content);
};

const sendReviewThanks = async (user, booking, rating) => {
    const stars = '⭐'.repeat(Math.max(1, Math.min(5, Math.round(Number(rating) || 0))));
    const content = `${stars}\n\n` +
        `Thanks for rating your booking #${bookingRef(booking)} for *${booking.serviceName}*!\n\n` +
        `We appreciate your feedback.\n\n- Team RozSewa`;
    return sendWhatsAppMessage(user.mobile, content);
};

module.exports = {
    sendWhatsAppMessage,
    sendAlert,
    alertWanted,
    sendBookingConfirmed,
    sendBookingStatusUpdate,
    sendInvoice,
    sendReviewRequest,
    sendReviewThanks
};
