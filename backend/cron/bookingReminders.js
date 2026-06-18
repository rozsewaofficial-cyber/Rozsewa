const cron = require('node-cron');
const Booking = require('../models/Booking');
const { getIO } = require('../config/socket');

const startBookingReminderCron = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const io = getIO();
            if (!io) return;

            // Find all confirmed bookings
            const bookings = await Booking.find({ status: 'confirmed' });

            const now = new Date();

            for (const booking of bookings) {
                if (!booking.bookingDate || !booking.bookingTime || !booking.providerId) continue;

                // Expected format: bookingDate: "2026-06-18", bookingTime: "05:00 PM"
                const [year, month, day] = booking.bookingDate.split('-');
                const timeParts = booking.bookingTime.split(' ');
                let [hours, minutes] = timeParts[0].split(':').map(Number);
                if (timeParts[1]) {
                    const ampm = timeParts[1].toUpperCase();
                    if (ampm === 'PM' && hours < 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;
                }

                if (!year || !month || !day || isNaN(hours) || isNaN(minutes)) continue;

                const bookingDateTime = new Date(year, month - 1, day, hours, minutes);
                
                const timeDiffMs = bookingDateTime - now;
                const timeDiffMinutes = timeDiffMs / (1000 * 60);

                // Send reminders at 30, 20, and 10 minutes before
                if (timeDiffMinutes > 29 && timeDiffMinutes <= 30) {
                    console.log(`Sending 30-min reminder to provider for booking: ${booking._id}`);
                    io.to(`provider_${booking.providerId}`).emit('BOOKING_REMINDER', { booking });
                } else if (timeDiffMinutes > 19 && timeDiffMinutes <= 20) {
                    console.log(`Sending 20-min reminder to provider for booking: ${booking._id}`);
                    io.to(`provider_${booking.providerId}`).emit('BOOKING_REMINDER', { booking });
                } else if (timeDiffMinutes > 9 && timeDiffMinutes <= 10) {
                    console.log(`Sending 10-min reminder to provider for booking: ${booking._id}`);
                    io.to(`provider_${booking.providerId}`).emit('BOOKING_REMINDER', { booking });
                }
            }
        } catch (error) {
            console.error('Error in booking reminder cron job:', error);
        }
    });
};

module.exports = startBookingReminderCron;
