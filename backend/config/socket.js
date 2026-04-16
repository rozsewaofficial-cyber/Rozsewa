const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "https://rozsewa.vercel.app",
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

        socket.on("reject_booking", ({ providerId, bookingId }) => {
            console.log(`Provider ${providerId} rejected booking ${bookingId}`);
            // Future: Store rejection in DB to prevent re-dispatching to this provider
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

module.exports = { initSocket, getIO, emitToProvider };
