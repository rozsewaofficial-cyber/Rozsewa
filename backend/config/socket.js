const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                process.env.FRONTEND_URL,
                'http://localhost:8080',
                'http://localhost:5173',
                'https://rozsewa.in',
                'https://www.rozsewa.in',
                'https://rozsewa.vercel.app'
            ].filter(Boolean),
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("Connect:", socket.id);

        socket.on("join_provider", (providerId) => {
            socket.join(`provider_${providerId}`);
            console.log(`Provider ${providerId} joined room`);
        });

        socket.on("join_user", (userId) => {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} joined room`);
        });

        socket.on("join_chat_room", (bookingId) => {
            socket.join(`booking_${bookingId}`);
            console.log(`Client ${socket.id} joined chat room booking_${bookingId}`);
        });

        socket.on("reject_booking", async ({ providerId, bookingId }) => {
            console.log(`Provider ${providerId} rejected booking ${bookingId}`);
            // Future: Store rejection in DB to prevent re-dispatching to this provider
            
            try {
                const Booking = require('../models/Booking');
                const booking = await Booking.findById(bookingId);
                if (booking) {
                    booking.status = 'cancelled';
                    await booking.save();
                    console.log(`Booking ${bookingId} status set to cancelled because provider ${providerId} rejected it`);
                    console.log(`Notifying user ${booking.userId} about rejection`);
                    io.to(`user_${booking.userId}`).emit('BOOKING_REJECTED', { bookingId, providerId });
                }
            } catch (err) {
                console.error("Error in reject_booking handler:", err);
            }
        });

        socket.on("disconnect", () => {
            console.log("Disconnect:", socket.id);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
};

const emitToProvider = (providerId, event, data) => {
    if (io) {
        io.to(`provider_${providerId}`).emit(event, data);
    }
};

const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user_${userId}`).emit(event, data);
    }
};

module.exports = { initSocket, getIO, emitToProvider, emitToUser };
