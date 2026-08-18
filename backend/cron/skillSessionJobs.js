const cron = require('node-cron');
const SkillSession = require('../models/SkillSession');
const Provider = require('../models/Provider');
const { allocate } = require('../utils/skillSessionAllocator');

const notify = async (sewakId, title, message, sessionId) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: sewakId,
            userRole: 'provider',
            title,
            message,
            type: 'skill_session',
            data: { id: sessionId.toString(), sessionId: sessionId.toString() }
        });
    } catch (err) {
        console.error('[SkillSessionCron] notification failed:', err.message);
    }
};

/** "2026-08-20" + "14:30" → Date */
const toDateTime = (isoDate, hhmm) => {
    if (!isoDate || !hhmm) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    const [h, min] = hhmm.split(':').map(Number);
    if (!y || !m || !d || isNaN(h) || isNaN(min)) return null;
    return new Date(y, m - 1, d, h, min);
};

/**
 * Reminders. Runs every 15 minutes and uses per-session flags rather than the
 * time window alone, so a restart mid-window can't double-send.
 */
const runReminders = async () => {
    try {
        const now = new Date();
        const sessions = await SkillSession.find({
            status: 'scheduled',
            $or: [{ remind1DaySent: false }, { remind2HourSent: false }]
        });

        for (const session of sessions) {
            const when = toDateTime(session.scheduledDate, session.scheduledTime);
            if (!when) continue;

            const minutesAway = (when - now) / 60000;
            if (minutesAway <= 0) continue;

            // 1-day reminder: fires anywhere in the 22h–26h band.
            if (!session.remind1DaySent && minutesAway <= 26 * 60 && minutesAway >= 22 * 60) {
                await notify(
                    session.sewakId,
                    'Session Reminder',
                    `Your ${session.serviceName} Skill Session is tomorrow at ${session.scheduledTime}.`,
                    session._id
                );
                session.remind1DaySent = true;
                await session.save();
                continue;
            }

            // 2-hour reminder: fires in the 1h45–2h15 band.
            if (!session.remind2HourSent && minutesAway <= 135 && minutesAway >= 105) {
                await notify(
                    session.sewakId,
                    'Session Starting Soon',
                    `Your ${session.serviceName} Skill Session starts at ${session.scheduledTime}, in about 2 hours.`,
                    session._id
                );
                session.remind2HourSent = true;
                await session.save();
            }
        }
    } catch (error) {
        console.error('[SkillSessionCron] reminder job failed:', error);
    }
};

/**
 * Retry allocation for sessions that had no capacity at booking time. Picks them
 * up automatically once an admin adds a center or trainer.
 */
const runPendingRetry = async () => {
    try {
        const pending = await SkillSession.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(100);
        if (!pending.length) return;

        for (const session of pending) {
            const provider = await Provider.findById(session.sewakId).select('city').lean();
            if (!provider) continue;

            const slot = await allocate({
                sewakCity: provider.city,
                categoryId: session.categoryId,
                mode: session.mode,
                durationMinutes: session.durationMinutes,
                // Never schedule into the past on a retry.
                preferredDate: session.preferredDate,
                preferredTimeOfDay: session.preferredTimeOfDay
            });

            session.allocationAttempts = (session.allocationAttempts || 0) + 1;

            if (slot) {
                Object.assign(session, slot, { status: 'scheduled' });
                await session.save();
                await notify(
                    session.sewakId,
                    'Session Confirmed',
                    `Your ${session.serviceName} Skill Session is confirmed for ${session.scheduledDate} at ${session.scheduledTime}.`,
                    session._id
                );
                console.log(`[SkillSessionCron] allocated pending session ${session._id}`);
            } else {
                await session.save();
            }
        }
    } catch (error) {
        console.error('[SkillSessionCron] pending retry job failed:', error);
    }
};

const startSkillSessionCron = () => {
    cron.schedule('*/15 * * * *', runReminders);
    cron.schedule('*/30 * * * *', runPendingRetry);
    console.log('Skill Session cron jobs scheduled.');
};

module.exports = { startSkillSessionCron, runReminders, runPendingRetry };
