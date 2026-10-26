const cron = require('node-cron');
const Booking = require('../models/Booking');
const { getIO } = require('../config/socket');

// Reminders go out this many minutes before the booking starts.
const REMINDER_MINUTES = [60, 30, 15, 5];
// A booking still gets its last reminder up to this long after its start time.
const GRACE_MINUTES = 5;

// Booking dates and times are entered and read as Indian time, whatever the
// server's own clock is set to (a server in UTC would otherwise remind 5½ hours
// early or late).
const IST_OFFSET_MS = 330 * 60 * 1000;
const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/** When a booking starts: bookingDate "2026-06-18" + bookingTime "05:00 PM", in IST. */
const startOf = (booking) => {
    if (!booking.bookingDate || !booking.bookingTime) return null;
    const [year, month, day] = booking.bookingDate.split('-');
    const timeParts = booking.bookingTime.split(' ');
    let [hours, minutes] = timeParts[0].split(':').map(Number);
    if (timeParts[1]) {
        const ampm = timeParts[1].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
    }
    if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) return null;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hours, minutes) - IST_OFFSET_MS);
};

/**
 * Which reminder, if any, a booking is due. Every slot that has come round and
 * not been sent counts as due, but only the nearest one is worth sending: a
 * booking confirmed 20 minutes out should hear "in 15 minutes", not a stale
 * "in an hour" as well. All the due slots are then recorded as sent.
 */
const dueReminder = (booking, now = new Date()) => {
    const start = startOf(booking);
    if (!start || !booking.providerId) return null;
    const minutesLeft = (start - now) / 60000;
    if (minutesLeft < -GRACE_MINUTES) return null;
    const sent = booking.remindersSent || [];
    const due = REMINDER_MINUTES.filter(m => minutesLeft <= m && !sent.includes(m));
    if (!due.length) return null;
    return { slot: Math.min(...due), allDue: due, minutesLeft: Math.max(0, Math.round(minutesLeft)) };
};

const reminderText = (booking, r) => {
    const when = r.minutesLeft <= 1 ? 'now' : `in ${r.minutesLeft} minutes`;
    return {
        title: `Reminder: ${booking.serviceName || 'your booking'} ${r.minutesLeft <= 1 ? 'starts now' : `in ${r.minutesLeft} minutes`}`,
        message: `Your booking for ${booking.serviceName || 'a service'} at ${booking.bookingTime} starts ${when}. Please get ready.`
    };
};

const startBookingReminderCron = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const io = getIO();
            if (!io) return;

            const now = new Date();

            // Check for expired counter-offers
            const expiredBookings = await Booking.find({
                status: 'pending',
                offerStatus: 'countered',
                counterOfferExpiresAt: { $lte: now }
            });

            for (const b of expiredBookings) {
                b.offerStatus = 'counter_expired';
                b.status = 'cancelled';
                await b.save();

                console.log(`Counter-offer expired for booking: ${b._id}`);
                
                // Notify user
                try {
                    const { notifyUser } = require('../config/notificationService');
                    await notifyUser({
                        userId: b.userId,
                        userRole: 'user',
                        title: 'Counter-Offer Expired',
                        message: `The counter-offer for ${b.serviceName} has expired and the booking has been cancelled.`,
                        type: 'booking',
                        bookingId: b._id
                    });
                } catch (err) {}

                // Notify provider
                if (b.providerId) {
                    try {
                        const { notifyUser } = require('../config/notificationService');
                        await notifyUser({
                            userId: b.providerId,
                            userRole: 'provider',
                            title: 'Counter-Offer Expired',
                            message: `Your counter-offer for ${b.serviceName} has expired as the customer did not respond in time.`,
                            type: 'booking',
                            bookingId: b._id
                        });
                    } catch (err) {}
                    
                    io.to(`provider_${b.providerId}`).emit('COUNTER_OFFER_EXPIRED', { bookingId: b._id.toString() });
                }
                io.to(`user_${b.userId}`).emit('COUNTER_OFFER_EXPIRED', { bookingId: b._id.toString() });
            }

            // Only bookings whose slot is near enough to remind about. This
            // read every confirmed booking on the platform every time it ran,
            // then threw away all but the next few hours' worth — and a
            // confirmed booking that never completes stays in that set forever.
            const today = istDay(Date.now());
            const tomorrow = istDay(Date.now() + 86400000);

            const bookings = await Booking.find({
                status: 'confirmed',
                bookingDate: { $in: [today, tomorrow] }
            });

            for (const booking of bookings) {
                const reminder = dueReminder(booking, now);
                if (!reminder) continue;

                // Claim the slots first, in one update that only succeeds for the first
                // caller, so two overlapping runs cannot both send.
                const claimed = await Booking.updateOne(
                    { _id: booking._id, remindersSent: { $not: { $in: reminder.allDue } } },
                    { $addToSet: { remindersSent: { $each: reminder.allDue } } }
                );
                if (!claimed.modifiedCount) continue;

                const { title, message } = reminderText(booking, reminder);
                console.log(`Sending ${reminder.slot}-min reminder to provider for booking: ${booking._id}`);
                // A real notification (app and push), not only a socket event: a partner
                // whose app is closed is exactly who needs the reminder.
                try {
                    const { notifyUser } = require('../config/notificationService');
                    await notifyUser({
                        userId: booking.providerId,
                        userRole: 'provider',
                        title,
                        message,
                        type: 'booking',
                        bookingId: booking._id,
                        data: { bookingId: booking._id.toString(), reminder: String(reminder.slot), link: '/provider/bookings' }
                    });
                } catch (err) {
                    console.error('Booking reminder notification failed:', err.message);
                }
                io.to(`provider_${booking.providerId}`).emit('BOOKING_REMINDER', { booking, minutesLeft: reminder.minutesLeft });
            }
        } catch (error) {
            console.error('Error in booking reminder cron job:', error);
        }
    });
};

module.exports = startBookingReminderCron;
module.exports.dueReminder = dueReminder;
module.exports.REMINDER_MINUTES = REMINDER_MINUTES;
