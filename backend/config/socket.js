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

    // Every connection must carry a valid session token. Who the socket is
    // comes from that token, never from ids the client sends afterwards —
    // otherwise anyone could join another account's room (or the admin room)
    // just by naming its id.
    io.use(async (socket, next) => {
        try {
            const jwt = require('jsonwebtoken');
            const token = socket.handshake.auth && socket.handshake.auth.token;
            if (!token) return next(new Error('Not authorized, no token'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const User = require('../models/User');
            const Provider = require('../models/Provider');
            let principal = await User.findById(decoded.id).select('role isActive');
            let role = principal ? (principal.role || 'customer') : null;
            if (!principal) {
                principal = await Provider.findById(decoded.id).select('_id');
                role = principal ? 'provider' : null;
            }
            if (!principal) return next(new Error('Not authorized, user not found'));
            if (role === 'customer' && principal.isActive === false) return next(new Error('Account blocked'));

            socket.data.id = principal._id.toString();
            socket.data.role = role;
            next();
        } catch (err) {
            next(new Error('Not authorized, token failed'));
        }
    });

    io.on("connection", (socket) => {
        console.log("Connect:", socket.id);
        const selfId = socket.data.id;
        const selfRole = socket.data.role;

        socket.on("join_provider", (providerId) => {
            if (selfRole !== 'provider' || String(providerId) !== selfId) return;
            socket.join(`provider_${selfId}`);
            console.log(`Provider ${selfId} joined room`);
        });

        socket.on("join_user", (userId) => {
            if (String(userId) !== selfId) return;
            socket.join(`user_${selfId}`);
            console.log(`User ${selfId} joined room`);
            if (['admin', 'superadmin', 'supervisor'].includes(selfRole)) {
                socket.join('admin_room');
                console.log(`Admin ${selfId} joined admin_room`);
            }
        });

        socket.on("join_chat_room", async (bookingId) => {
            try {
                const Booking = require('../models/Booking');
                const booking = await Booking.findById(bookingId).select('userId providerId');
                if (!booking) return;
                const isParty = [booking.userId, booking.providerId].some(p => p && p.toString() === selfId);
                if (!isParty && !['admin', 'superadmin', 'supervisor'].includes(selfRole)) return;
                socket.join(`booking_${bookingId}`);
                console.log(`Client ${socket.id} joined chat room booking_${bookingId}`);
            } catch (err) {
                console.error("Error joining chat room:", err.message);
            }
        });

        socket.on("reject_booking", async ({ bookingId, reason } = {}) => {
            if (selfRole !== 'provider') return;
            const providerId = selfId;
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

                    if (booking.providerId && booking.providerId.toString() === providerId.toString()) {
                        // Direct booking rejected -> Cancel entirely
                        booking.status = 'cancelled';
                        booking.cancellationReason = actReason === 'timeout' ? 'Provider did not respond in time.' : 'Provider declined the request.';
                        await booking.save();

                        console.log(`[Monitoring] Direct booking ${bookingId} cancelled as specific provider ${providerId} rejected/timed out.`);
                        io.to(`user_${booking.userId}`).emit('BOOKING_STATUS_UPDATED', { bookingId, status: 'cancelled' });

                        try {
                            const { notifyUser } = require('../config/notificationService');
                            const User = require('../models/User');
                            const user = await User.findById(booking.userId);
                            if (user) {
                                await notifyUser(user, 'booking_cancelled', {
                                    title: 'Booking Cancelled',
                                    body: `Your service request for ${booking.serviceName} was declined by the provider.`,
                                    data: { bookingId: booking._id.toString() }
                                });
                            }
                        } catch (notifErr) {
                            console.error("Error sending cancellation notification:", notifErr);
                        }
                    } else {
                        // Broadcast booking -> just record rejection and keep it pending for others
                        if (!booking.rejectedProviders) {
                            booking.rejectedProviders = [];
                        }
                        if (!booking.rejectedProviders.includes(providerId)) {
                            booking.rejectedProviders.push(providerId);
                            await booking.save();
                        }
                        // Broadcast to other sockets to refresh available request lists
                        io.emit('NEW_BOOKING_REQUEST');
                    }
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
