const cron = require('node-cron');
const ProviderBanner = require('../models/ProviderBanner');
const Notification = require('../models/Notification'); // Assuming there's a Notification model
const { getIO } = require('../config/socket'); // Assuming there's a socket config

const startBannerCronJobs = () => {
    // Run daily at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('[CRON] Running daily banner status check...');
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 1. Activate approved banners whose start date has arrived
            const toActivate = await ProviderBanner.updateMany(
                { status: 'Approved', startDate: { $lte: today } },
                { $set: { status: 'Active' } }
            );
            if (toActivate.modifiedCount > 0) {
                console.log(`[CRON] Activated ${toActivate.modifiedCount} banners.`);
            }

            // 2. Expire active banners whose end date has passed
            const toExpire = await ProviderBanner.find({ status: 'Active', endDate: { $lt: today } });
            
            for (let banner of toExpire) {
                banner.status = 'Expired';
                await banner.save();
                
                // Notify provider
                const notif = new Notification({
                    recipient: banner.provider,
                    recipientModel: 'Provider',
                    title: 'Banner Expired',
                    message: `Your ${banner.planType} promotion banner has expired. Renew it now to maintain your visibility!`
                });
                await notif.save();
                
                const io = getIO();
                if (io) {
                    io.to(banner.provider.toString()).emit('newNotification', notif);
                }
            }
            if (toExpire.length > 0) {
                console.log(`[CRON] Expired ${toExpire.length} banners.`);
            }

            // 3. Send reminders for banners expiring in 3 days
            const threeDaysFromNow = new Date(today);
            threeDaysFromNow.setDate(today.getDate() + 3);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const toRemind = await ProviderBanner.find({
                status: 'Active',
                endDate: { $gte: today, $lte: threeDaysFromNow }
            });

            // Note: We might want a flag like 'reminderSent' so we don't spam them every day, 
            // but for now we'll just send it if it's exactly 3 days away
            for (let banner of toRemind) {
                // If it's exactly 3 days away
                const endStr = banner.endDate.toISOString().split('T')[0];
                const threeStr = threeDaysFromNow.toISOString().split('T')[0];
                
                if (endStr === threeStr) {
                    const notif = new Notification({
                        recipient: banner.provider,
                        recipientModel: 'Provider',
                        title: 'Banner Expiring Soon',
                        message: `Your ${banner.planType} promotion banner will expire in 3 days. Prepare to renew it to keep getting more orders!`
                    });
                    await notif.save();
                    
                    const io = getIO();
                    if (io) {
                        io.to(banner.provider.toString()).emit('newNotification', notif);
                    }
                }
            }
            
        } catch (error) {
            console.error('[CRON] Error in banner status check:', error);
        }
    });
};

module.exports = startBannerCronJobs;
