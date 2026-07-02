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

        socket.on("reject_booking", async ({ providerId, bookingId, reason }) => {
            const actReason = reason || 'reject';
            console.log(`Provider ${providerId} rejected booking ${bookingId} with reason: ${actReason}`);
            
            try {
                const Booking = require('../models/Booking');
                const booking = await Booking.findById(bookingId);
                if (booking && booking.status === 'pending') {
                    if (actReason === 'timeout') {
                        console.log(`[Monitoring] Booking timeout event: Provider ${providerId} did not respond to Booking ${bookingId} within 2-minute limit.`);
                    } else {
                        console.log(`[Monitoring] Booking rejection event: Provider ${providerId} explicitly rejected Booking ${bookingId}.`);
                    }

                    if (!booking.rejectedProviders) {
                        booking.rejectedProviders = [];
                    }
                    const alreadyRejected = booking.rejectedProviders.some(
                        (id) => id.toString() === providerId.toString()
                    );
                    if (!alreadyRejected) {
                        booking.rejectedProviders.push(providerId);
                        await booking.save();
                    }

                    // Broadcast to other sockets to refresh available request lists
                    io.emit('NEW_BOOKING_REQUEST');
                } else if (booking) {
                    console.log(`Booking ${bookingId} reject ignored because status is ${booking.status}`);
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
    if (io && providerId) {
        const idStr = providerId._id ? providerId._id.toString() : providerId.toString();
        io.to(`provider_${idStr}`).emit(event, data);
    }
};

const emitToUser = (userId, event, data) => {
    if (io && userId) {
        const idStr = userId._id ? userId._id.toString() : userId.toString();
        io.to(`user_${idStr}`).emit(event, data);
    }
};

module.exports = { initSocket, getIO, emitToProvider, emitToUser };
