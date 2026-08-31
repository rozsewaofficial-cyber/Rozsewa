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
    sendBookingConfirmed,
    sendBookingStatusUpdate,
    sendInvoice,
    sendReviewRequest,
    sendReviewThanks
};
