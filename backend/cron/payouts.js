const cron = require('node-cron');
const { Wallet } = require('../models/Wallet');
const Provider = require('../models/Provider');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');

// Helper to get config
const getConfig = async () => {
    let config;
    try {
        const configData = await Setting.findOne({ key: 'partner_program_config' });
        if (configData) config = JSON.parse(configData.value);
    } catch (err) {}
    return config || { attendance: { requiredDays: 30 } };
};

// 1. Weekly Payout Processor (Every Monday at 12:00 AM)
cron.schedule('0 0 * * 1', async () => {
    try {
        console.log('Running weekly payout cron job...');
        // Find wallets with balance >= 500 (Minimum Cash Limit)
        const wallets = await Wallet.find({ balance: { $gte: 500 } }).populate('providerId');

        const Withdrawal = require('../models/Withdrawal'); 

        for (const wallet of wallets) {
            if(Withdrawal) {
                await Withdrawal.create({
                    providerId: wallet.providerId._id,
                    amount: wallet.balance,
                    status: 'pending',
                    requestDate: new Date()
                });
                console.log(`Generated payout request for ${wallet.providerId.name}: ₹${wallet.balance}`);
            }
        }
    } catch (err) {
        console.error('Error in weekly payout cron:', err);
    }
});

// 2. Monthly Attendance Bonus Tracker (1st of every month at 1:00 AM)
cron.schedule('0 1 1 * *', async () => {
    try {
        console.log('Running monthly attendance bonus checker...');
        const config = await getConfig();
        const providers = await Provider.find({ providerCategory: 'partner' });
        
        const daysRequired = config.attendance.requiredDays || 30;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysRequired);

        for (const provider of providers) {
            // Find bookings for this provider in the last N days
            const recentBookings = await Booking.find({
                providerId: provider._id,
                status: 'completed',
                createdAt: { $gte: targetDate }
            });

            // Group by distinct days
            const distinctDays = new Set(
                recentBookings.map(b => b.createdAt.toISOString().split('T')[0])
            );

            provider.attendanceBonusActive = distinctDays.size >= daysRequired;
            provider.attendanceDays = distinctDays.size;
            await provider.save();
        }
        console.log('Attendance bonus check completed.');
    } catch (err) {
        console.error('Error in monthly attendance cron:', err);
    }
});

module.exports = {
    startCronJobs: () => {
        console.log('Partner Program Cron Jobs Initialized.');
    }
};
