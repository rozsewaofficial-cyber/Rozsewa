const cron = require('node-cron');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const AuditLog = require('../models/AuditLog');
const { notifyUser } = require('../config/notificationService');

const systemActorId = new mongoose.Types.ObjectId('000000000000000000000000');

const runLeadExpiryCheck = async () => {
    console.log('[LeadJobs] Running hourly lead expiry check...');
    try {
        const now = new Date();

        // Find all active/partially-unlocked leads past expiry
        const expiredLeads = await Lead.find({
            status: { $in: ['available', 'partially_unlocked', 'draft'] },
            expiry: { $lte: now }
        }).lean();

        if (expiredLeads.length === 0) return;

        const leadIds = expiredLeads.map(l => l._id);
        await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: { status: 'expired' } }
        );

        // Audit and notify for each expired lead
        for (const lead of expiredLeads) {
            try {
                // LeadActivity audit entry
                await LeadActivity.create({
                    leadId: lead._id,
                    actorId: systemActorId,
                    actorRole: 'system',
                    event: 'LEAD_EXPIRED',
                    detail: { expiredAt: now, previousStatus: lead.status }
                });

                // Notify customer
                if (lead.customer) {
                    await notifyUser({
                        userId: lead.customer,
                        userRole: 'customer',
                        title: 'Your Lead Has Expired',
                        message: 'Your service request has expired as no provider was selected. You can submit a new request anytime.',
                        type: 'lead',
                        data: { leadId: lead._id.toString() }
                    });
                }

                // Notify all nearby providers
                for (const providerId of (lead.nearbyProviders || [])) {
                    await notifyUser({
                        userId: providerId,
                        userRole: 'provider',
                        title: 'Lead Expired',
                        message: `A lead you were eligible for has now expired.`,
                        type: 'lead',
                        data: { leadId: lead._id.toString() }
                    });
                }
            } catch (e) {
                console.error(`[LeadJobs] Notify error for lead ${lead._id}:`, e.message);
            }
        }

        await AuditLog.create({
            actionType: 'AUTO_LEAD_EXPIRY',
            entityType: 'LEAD',
            entityId: leadIds[0],
            entityName: `${leadIds.length} leads expired automatically`,
            verifiedBy: systemActorId,
            verifiedByName: 'System Cron',
            verifiedByRole: 'system',
            details: { expiredLeadIds: leadIds, count: leadIds.length }
        });

        console.log(`[LeadJobs] Expired ${expiredLeads.length} leads.`);
    } catch (err) {
        console.error('[LeadJobs] Error in lead expiry job:', err.message);
    }
};

const runLeadArchiveJob = async () => {
    console.log('[LeadJobs] Running weekly lead archive/cleanup job...');
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Close old leads using new 9-status lifecycle names
        const result = await Lead.updateMany(
            {
                status: { $in: ['expired', 'cancelled', 'disputed', 'refunded'] },
                createdAt: { $lte: thirtyDaysAgo }
            },
            { $set: { status: 'closed' } }
        );
        console.log(`[LeadJobs] Archived ${result.modifiedCount} old leads.`);
    } catch (err) {
        console.error('[LeadJobs] Error in lead archive job:', err.message);
    }
};

const startLeadJobsCron = () => {
    // Run hourly lead expiry check
    cron.schedule('0 * * * *', runLeadExpiryCheck);

    // Run weekly lead cleanup on Sundays at midnight
    cron.schedule('0 0 * * 0', runLeadArchiveJob);

    console.log('[LeadJobs] Lead background maintenance cron jobs scheduled.');
};

module.exports = {
    startLeadJobsCron,
    runLeadExpiryCheck,
    runLeadArchiveJob
};
