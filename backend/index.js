const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const walletRoutes = require('./routes/walletRoutes');
const providerRoutes = require('./routes/providerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const supportRoutes = require('./routes/supportRoutes');
const wfhRoutes = require('./routes/wfhRoutes');
const faqRoutes = require('./routes/faqRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
// const digilockerRoutes = require('./routes/digilockerRoutes');
const mockRoutes = require('./routes/mockRoutes');
const chatRoutes = require('./routes/chatRoutes');
const guideRoutes = require('./routes/guideRoutes');
const scrapRoutes = require('./routes/scrapRoutes');
const bazaarRoutes = require('./routes/bazaarRoutes');
const leadRoutes = require('./routes/leadRoutes');
const skillSessionRoutes = require('./routes/skillSessionRoutes');
const trainerRoutes = require('./routes/trainerRoutes');

const http = require('http');
const path = require('path');
const { initSocket } = require('./config/socket');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:8080',
    'http://localhost:5173',
    'https://rozsewa.in',
    'https://www.rozsewa.in',
    'https://rozsewa.vercel.app'
].filter(Boolean);

console.log('CORS Allowed Origins:', allowedOrigins);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json());
app.use('/sounds', express.static(path.join(__dirname, '/'))); // Serve root for sounds

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/wfh', wfhRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/verify', verifyRoutes);
// app.use('/api/digilocker', digilockerRoutes);
app.use('/mock', mockRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/scrap', scrapRoutes);
app.use('/api/bazaar', bazaarRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/skill-sessions', skillSessionRoutes);
app.use('/api/trainer', trainerRoutes);

// V2 Versioned Commission APIs
const { adminV2Router, providerV2Router } = require('./routes/v2Routes');
app.use('/api/v2/admin', adminV2Router);
app.use('/api/v2/provider', providerV2Router);

// Start Cron Jobs
const { startCronJobs } = require('./cron/payouts');
const startBookingReminderCron = require('./cron/bookingReminders');
const { startSubscriptionCheckCron } = require('./cron/subscriptionCheck');
const { startLeadJobsCron } = require('./cron/leadJobs');
const startBannerCronJobs = require('./cron/bannerJobs');
const { startSkillSessionCron } = require('./cron/skillSessionJobs');
startCronJobs();
startBookingReminderCron();
startSubscriptionCheckCron();
startLeadJobsCron();
startBannerCronJobs();
startSkillSessionCron();
app.get('/', (req, res) => {
    res.send('rozsewa API is running...');
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
