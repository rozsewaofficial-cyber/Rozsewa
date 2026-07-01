const cron = require('node-cron');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const AuditLog = require('../models/AuditLog');

const runLeadExpiryCheck = async () => {
    console.log('Running hourly lead expiry check...');
    try {
        const now = new Date();
        // Find all available or unlocked leads that have past their expiry time
        const expiredLeads = await Lead.find({
            status: { $in: ['available', 'unlocked'] },
            expiry: { $lte: now }
        });

        if (expiredLeads.length > 0) {
            const leadIds = expiredLeads.map(l => l._id);
            await Lead.updateMany(
                { _id: { $in: leadIds } },
                { $set: { status: 'expired' } }
            );

            // Log the expiry action
            await AuditLog.create({
                actionType: 'AUTO_LEAD_EXPIRY',
                entityType: 'LEAD',
                entityId: leadIds[0], // log reference
                entityName: `${leadIds.length} leads expired automatically`,
                verifiedBy: new mongoose.Types.ObjectId(), // system ID
                verifiedByName: 'System Cron',
                verifiedByRole: 'system',
                details: { expiredLeadIds: leadIds }
            });
            console.log(`Successfully expired ${expiredLeads.length} leads.`);
        }
    } catch (err) {
        console.error('Error in lead expiry job:', err.message);
    }
};

const runLeadArchiveJob = async () => {
    console.log('Running weekly lead archive/cleanup job...');
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Find all expired/completed/cancelled leads older than 30 days and mark them closed
        const result = await Lead.updateMany(
            {
                status: { $in: ['expired', 'completed', 'cancelled', 'disputed'] },
                createdAt: { $lte: thirtyDaysAgo }
            },
            { $set: { status: 'closed' } }
        );
        console.log(`Archived/Closed ${result.modifiedCount} old leads.`);
    } catch (err) {
        console.error('Error in lead archive job:', err.message);
    }
};

const startLeadJobsCron = () => {
    // Run hourly lead expiry check
    cron.schedule('0 * * * *', runLeadExpiryCheck);

    // Run weekly lead cleanup on Sundays at midnight
    cron.schedule('0 0 * * 0', runLeadArchiveJob);

    console.log('Lead Model background maintenance cron jobs scheduled.');
};

module.exports = {
    startLeadJobsCron,
    runLeadExpiryCheck,
    runLeadArchiveJob
};
