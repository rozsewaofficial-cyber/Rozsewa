const mongoose = require('mongoose');
const SkillSession = require('../models/SkillSession');
const TrainingCenter = require('../models/TrainingCenter');
const Trainer = require('../models/Trainer');
const Provider = require('../models/Provider');
const Category = require('../models/Category');
const Service = require('../models/Service');
const { allocate, isOverCapacity } = require('../utils/skillSessionAllocator');

const normalizeKey = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const ACTIVE_STATUSES = ['pending', 'scheduled'];

/**
 * Skill-session config for a service, read from the category catalog.
 * Falls back to the standalone Service doc when the catalog has no entry.
 */
const resolveSkillConfig = async (categoryId, serviceName) => {
    const key = normalizeKey(serviceName);
    if (!key) return null;

    const category = await Category.findById(categoryId).lean();
    if (category) {
        const entry = (category.services || []).find(s => normalizeKey(s.name) === key);
        if (entry) {
            return {
                required: !!entry.skillSessionRequired && entry.skillSessionActive !== false,
                mode: entry.sessionMode || 'offline',
                durationMinutes: Number(entry.sessionDurationMinutes) || 60,
                serviceName: entry.name,
                serviceId: entry._id || null
            };
        }
    }

    const svc = await Service.findOne({ categoryId, name: new RegExp(`^\\s*${serviceName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }).lean();
    if (svc) {
        return {
            required: !!svc.skillSessionRequired && svc.skillSessionActive !== false,
            mode: svc.sessionMode || 'offline',
            durationMinutes: Number(svc.sessionDurationMinutes) || 60,
            serviceName: svc.name,
            serviceId: svc._id
        };
    }

    return null;
};

const hasCertification = (provider, categoryId, serviceKey) =>
    (provider.skillCertifications || []).some(c =>
        String(c.categoryId) === String(categoryId) && c.serviceKey === serviceKey
    );

/** Fire-and-forget — a notification failure must never fail the caller's flow. */
const notify = async (sewakId, title, message, sessionId) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: sewakId,
            userRole: 'provider',
            title,
            message,
            type: 'skill_session',
            // notifyUser dedupes on data.bookingId || data.leadId || data.id — without
            // this every session's notifications collapse onto one shared key.
            data: { id: sessionId ? sessionId.toString() : '', sessionId: sessionId ? sessionId.toString() : '' }
        });
    } catch (err) {
        console.error('[SkillSession] notification failed:', err.message);
    }
};

const populateSession = (q) => q
    .populate('centerId', 'name address contactNumber cities')
    .populate('trainerId', 'name mobile')
    .populate('categoryId', 'name icon');

// ─────────────────────────────────────────────────────────────────────────────
// SEWAK
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Which of my services need a Skill Session, and their current state
// @route   GET /api/skill-sessions/eligibility
// @access  Private (Sewak/Provider)
const getEligibility = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id).lean();
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        const categoryId = provider.vendorType;
        if (!categoryId) return res.json([]);

        const category = await Category.findById(categoryId).lean();
        const catalog = (category?.services || []);

        const sessions = await SkillSession.find({ sewakId: provider._id })
            .sort({ createdAt: -1 })
            .lean();

        const rows = (provider.subServices || []).map(name => {
            const key = normalizeKey(name);
            const entry = catalog.find(s => normalizeKey(s.name) === key);

            const required = !!entry?.skillSessionRequired && entry?.skillSessionActive !== false;
            if (!required) {
                return {
                    serviceName: name,
                    required: false,
                    mode: null,
                    durationMinutes: null,
                    sessionStatus: 'not_required',
                    sessionId: null
                };
            }

            if (hasCertification(provider, categoryId, key)) {
                const done = sessions.find(s => s.serviceKey === key && s.status === 'completed');
                return {
                    serviceName: name,
                    required: true,
                    mode: entry.sessionMode || 'offline',
                    durationMinutes: Number(entry.sessionDurationMinutes) || 60,
                    sessionStatus: 'completed',
                    sessionId: done?._id || null
                };
            }

            // Most recent session for this service decides what the Sewak sees.
            const latest = sessions.find(s => s.serviceKey === key && s.status !== 'cancelled');
            return {
                serviceName: name,
                required: true,
                mode: entry.sessionMode || 'offline',
                durationMinutes: Number(entry.sessionDurationMinutes) || 60,
                sessionStatus: latest ? latest.status : 'not_booked',
                sessionId: latest?._id || null
            };
        });

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Book a Skill Session
// @route   POST /api/skill-sessions/book
// @access  Private (Sewak/Provider)
const bookSession = async (req, res) => {
    try {
        const { serviceName, preferredDate, preferredTimeOfDay } = req.body;
        let { categoryId } = req.body;

        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });

        categoryId = categoryId || provider.vendorType;
        if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'A valid service category is required' });
        }
        if (!serviceName || !serviceName.trim()) {
            return res.status(400).json({ message: 'Service name is required' });
        }
        if (!preferredDate || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
            return res.status(400).json({ message: 'Please choose a preferred date' });
        }
        if (!['morning', 'afternoon', 'evening'].includes(preferredTimeOfDay)) {
            return res.status(400).json({ message: 'Please choose a preferred time' });
        }

        const config = await resolveSkillConfig(categoryId, serviceName);
        if (!config) return res.status(404).json({ message: 'Service not found in this category' });
        if (!config.required) {
            return res.status(400).json({ message: 'This service does not require a Skill Session' });
        }

        const serviceKey = normalizeKey(config.serviceName);

        if (hasCertification(provider, categoryId, serviceKey)) {
            return res.status(400).json({ message: 'You have already completed the Skill Session for this service' });
        }

        // Guard against a double-tap consuming two seats.
        const existing = await SkillSession.findOne({
            sewakId: provider._id,
            categoryId,
            serviceKey,
            status: { $in: ACTIVE_STATUSES }
        });
        if (existing) {
            return res.status(400).json({
                message: existing.status === 'scheduled'
                    ? 'A session for this service is already scheduled'
                    : 'A session for this service is already being confirmed'
            });
        }

        const session = new SkillSession({
            sewakId: provider._id,
            categoryId,
            serviceName: config.serviceName,
            serviceKey,
            serviceId: config.serviceId,
            mode: config.mode,
            durationMinutes: config.durationMinutes,
            preferredDate,
            preferredTimeOfDay,
            status: 'pending'
        });

        const slot = await allocate({
            sewakCity: provider.city,
            categoryId,
            mode: config.mode,
            durationMinutes: config.durationMinutes,
            preferredDate,
            preferredTimeOfDay
        });

        if (slot) {
            Object.assign(session, slot, { status: 'scheduled' });
        }
        session.allocationAttempts = 1;
        await session.save();

        await notify(
            provider._id,
            'Booking Received',
            `Your Skill Session request for ${config.serviceName} has been received.`,
            session._id
        );

        if (slot) {
            // Optimistic re-check — a concurrent booking may have taken the last seat.
            if (await isOverCapacity(session)) {
                const retry = await allocate({
                    sewakCity: provider.city,
                    categoryId,
                    mode: config.mode,
                    durationMinutes: config.durationMinutes,
                    preferredDate,
                    preferredTimeOfDay
                });
                if (retry) {
                    Object.assign(session, retry);
                } else {
                    session.status = 'pending';
                    session.centerId = null;
                    session.trainerId = null;
                    session.scheduledDate = '';
                    session.scheduledTime = '';
                }
                await session.save();
            }

            if (session.status === 'scheduled') {
                await notify(
                    provider._id,
                    'Session Confirmed',
                    `Your ${config.serviceName} Skill Session is confirmed for ${session.scheduledDate} at ${session.scheduledTime}.`,
                    session._id
                );
            }
        }

        const populated = await populateSession(SkillSession.findById(session._id));
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    My sessions
// @route   GET /api/skill-sessions/mine
// @access  Private (Sewak/Provider)
const getMySessions = async (req, res) => {
    try {
        const sessions = await populateSession(
            SkillSession.find({ sewakId: req.user._id })
        ).sort({ createdAt: -1 });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    One session
// @route   GET /api/skill-sessions/:id
// @access  Private (Sewak/Provider)
const getSessionById = async (req, res) => {
    try {
        const session = await populateSession(SkillSession.findById(req.params.id));
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (String(session.sewakId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorised to view this session' });
        }
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel my session
// @route   PUT /api/skill-sessions/:id/cancel
// @access  Private (Sewak/Provider)
const cancelSession = async (req, res) => {
    try {
        const session = await SkillSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (String(session.sewakId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorised to cancel this session' });
        }
        if (!ACTIVE_STATUSES.includes(session.status)) {
            return res.status(400).json({ message: `A ${session.status} session cannot be cancelled` });
        }

        session.status = 'cancelled';
        session.cancelledAt = new Date();
        await session.save();

        res.json({ message: 'Session cancelled', session });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// @desc    List sessions with filters
// @route   GET /api/admin/skill-sessions
// @access  Private/Admin
const getAdminSessions = async (req, res) => {
    try {
        const { status, mode, centerId, trainerId, dateFrom, dateTo, sewakId } = req.query;
        const query = {};
        if (status) query.status = status;
        if (mode) query.mode = mode;
        if (centerId && mongoose.Types.ObjectId.isValid(centerId)) query.centerId = centerId;
        if (trainerId && mongoose.Types.ObjectId.isValid(trainerId)) query.trainerId = trainerId;
        if (sewakId && mongoose.Types.ObjectId.isValid(sewakId)) query.sewakId = sewakId;
        if (dateFrom || dateTo) {
            query.scheduledDate = {};
            if (dateFrom) query.scheduledDate.$gte = dateFrom;
            if (dateTo) query.scheduledDate.$lte = dateTo;
        }

        const sessions = await populateSession(SkillSession.find(query))
            .populate('sewakId', 'ownerName mobile city vendorCode')
            .sort({ status: 1, scheduledDate: 1, scheduledTime: 1, createdAt: -1 })
            .lean();

        // Pending first — they are the only rows that need a human.
        const rank = { pending: 0, scheduled: 1, completed: 2, no_show: 3, cancelled: 4 };
        sessions.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually assign a center, trainer and slot
// @route   PUT /api/admin/skill-sessions/:id/assign
// @access  Private/Admin
const assignSession = async (req, res) => {
    try {
        const { centerId, trainerId, scheduledDate, scheduledTime } = req.body;
        const session = await SkillSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (['completed', 'no_show', 'cancelled'].includes(session.status)) {
            return res.status(400).json({ message: `A ${session.status} session cannot be reassigned` });
        }

        if (!mongoose.Types.ObjectId.isValid(centerId) || !mongoose.Types.ObjectId.isValid(trainerId)) {
            return res.status(400).json({ message: 'A center and trainer are required' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate || '')) {
            return res.status(400).json({ message: 'A valid date is required' });
        }
        if (!/^\d{2}:\d{2}$/.test(scheduledTime || '')) {
            return res.status(400).json({ message: 'A valid time is required' });
        }

        const [center, trainer] = await Promise.all([
            TrainingCenter.findById(centerId),
            Trainer.findById(trainerId)
        ]);
        if (!center) return res.status(404).json({ message: 'Training center not found' });
        if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
        if (String(trainer.trainingCenter) !== String(center._id)) {
            return res.status(400).json({ message: 'That trainer does not belong to the selected center' });
        }

        // Manual assignment respects the same ceilings as the allocator.
        const trainerBooked = await SkillSession.countDocuments({
            _id: { $ne: session._id },
            trainerId, scheduledDate, scheduledTime, status: 'scheduled'
        });
        if (trainerBooked >= trainer.capacity) {
            return res.status(400).json({ message: `${trainer.name} is at capacity for that slot (${trainer.capacity})` });
        }
        const centerBooked = await SkillSession.countDocuments({
            _id: { $ne: session._id },
            centerId, scheduledDate, status: 'scheduled'
        });
        if (centerBooked >= center.capacity) {
            return res.status(400).json({ message: `${center.name} is at capacity for that day (${center.capacity})` });
        }

        session.centerId = centerId;
        session.trainerId = trainerId;
        session.scheduledDate = scheduledDate;
        session.scheduledTime = scheduledTime;
        session.status = 'scheduled';
        // A moved session earns fresh reminders.
        session.remind1DaySent = false;
        session.remind2HourSent = false;
        await session.save();

        await notify(
            session.sewakId,
            'Session Confirmed',
            `Your ${session.serviceName} Skill Session is confirmed for ${scheduledDate} at ${scheduledTime}.`,
            session._id
        );

        const populated = await populateSession(SkillSession.findById(session._id));
        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add or update the meeting link for an online session
// @route   PUT /api/admin/skill-sessions/:id/meeting-link
// @access  Private/Admin
const setMeetingLink = async (req, res) => {
    try {
        const { meetingLink } = req.body;
        if (!meetingLink || !/^https?:\/\//i.test(meetingLink.trim())) {
            return res.status(400).json({ message: 'Enter a valid meeting link starting with http:// or https://' });
        }

        const session = await SkillSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.mode !== 'online') {
            return res.status(400).json({ message: 'Only online sessions take a meeting link' });
        }

        const isNew = !session.meetingLink;
        session.meetingLink = meetingLink.trim();
        await session.save();

        if (isNew) {
            await notify(
                session.sewakId,
                'Meeting Link Available',
                `The meeting link for your ${session.serviceName} Skill Session is now available.`,
                session._id
            );
        }

        res.json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark attendance — the single write point for skillCertifications
// @route   PUT /api/admin/skill-sessions/:id/attendance
// @access  Private/Admin
const markAttendance = async (req, res) => {
    try {
        const { attendance } = req.body; // 'present' | 'no_show'
        if (!['present', 'no_show'].includes(attendance)) {
            return res.status(400).json({ message: "Attendance must be 'present' or 'no_show'" });
        }

        const session = await SkillSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.status !== 'scheduled') {
            return res.status(400).json({ message: `Attendance can only be marked on a scheduled session (this one is ${session.status})` });
        }

        session.status = attendance === 'present' ? 'completed' : 'no_show';
        session.attendanceMarkedBy = req.user._id;
        session.attendanceMarkedAt = new Date();
        await session.save();

        if (session.status === 'completed') {
            const provider = await Provider.findById(session.sewakId);
            if (provider) {
                const already = (provider.skillCertifications || []).some(c =>
                    String(c.categoryId) === String(session.categoryId) && c.serviceKey === session.serviceKey
                );
                if (!already) {
                    provider.skillCertifications.push({
                        categoryId: session.categoryId,
                        serviceKey: session.serviceKey,
                        serviceName: session.serviceName,
                        sessionId: session._id,
                        completedAt: session.attendanceMarkedAt
                    });
                    await provider.save();
                }

                // Release any services held behind this gate.
                await Service.updateMany(
                    {
                        providerId: provider._id,
                        pendingSkillSession: true,
                        name: new RegExp(`^\\s*${session.serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
                    },
                    { $set: { pendingSkillSession: false, visible: true } }
                );
            }

            await notify(
                session.sewakId,
                'Skill Session Completed',
                `You have completed the ${session.serviceName} Skill Session. Your service is ready for activation.`,
                session._id
            );
        } else {
            await notify(
                session.sewakId,
                'Session Missed',
                `You were marked absent for the ${session.serviceName} Skill Session. Contact support to reschedule.`,
                session._id
            );
        }

        const populated = await populateSession(SkillSession.findById(session._id));
        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Schedule a re-session (a new record, chained to the original)
// @route   POST /api/admin/skill-sessions/:id/re-session
// @access  Private/Admin
const createReSession = async (req, res) => {
    try {
        const parent = await SkillSession.findById(req.params.id);
        if (!parent) return res.status(404).json({ message: 'Session not found' });
        if (!['completed', 'no_show'].includes(parent.status)) {
            return res.status(400).json({ message: 'Only a completed or missed session can be repeated' });
        }

        const active = await SkillSession.findOne({
            sewakId: parent.sewakId,
            categoryId: parent.categoryId,
            serviceKey: parent.serviceKey,
            status: { $in: ACTIVE_STATUSES }
        });
        if (active) return res.status(400).json({ message: 'This Sewak already has an active session for this service' });

        const provider = await Provider.findById(parent.sewakId).lean();
        const preferredDate = req.body.preferredDate || parent.scheduledDate || parent.preferredDate;
        const preferredTimeOfDay = req.body.preferredTimeOfDay || parent.preferredTimeOfDay;

        const child = new SkillSession({
            sewakId: parent.sewakId,
            categoryId: parent.categoryId,
            serviceName: parent.serviceName,
            serviceKey: parent.serviceKey,
            serviceId: parent.serviceId,
            mode: parent.mode,
            durationMinutes: parent.durationMinutes,
            preferredDate,
            preferredTimeOfDay,
            isReSession: true,
            parentSessionId: parent._id,
            reSessionRound: (parent.reSessionRound || 0) + 1,
            status: 'pending',
            allocationAttempts: 1
        });

        const slot = await allocate({
            sewakCity: provider?.city,
            categoryId: parent.categoryId,
            mode: parent.mode,
            durationMinutes: parent.durationMinutes,
            preferredDate,
            preferredTimeOfDay
        });
        if (slot) Object.assign(child, slot, { status: 'scheduled' });
        await child.save();

        await notify(
            child.sewakId,
            slot ? 'Session Confirmed' : 'Booking Received',
            slot
                ? `Your repeat ${child.serviceName} Skill Session is confirmed for ${child.scheduledDate} at ${child.scheduledTime}.`
                : `A repeat ${child.serviceName} Skill Session has been requested for you.`,
            child._id
        );

        const populated = await populateSession(SkillSession.findById(child._id));
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Aggregated reports
// @route   GET /api/admin/skill-sessions/reports
// @access  Private/Admin
const getSkillSessionReports = async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        const match = {};
        if (dateFrom || dateTo) {
            match.scheduledDate = {};
            if (dateFrom) match.scheduledDate.$gte = dateFrom;
            if (dateTo) match.scheduledDate.$lte = dateTo;
        }

        const [facet] = await SkillSession.aggregate([
            { $match: match },
            {
                $facet: {
                    byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
                    byMode: [{ $group: { _id: '$mode', n: { $sum: 1 } } }],
                    reSessions: [{ $match: { isReSession: true } }, { $count: 'n' }],
                    total: [{ $count: 'n' }],
                    byService: [
                        { $group: { _id: '$serviceName', n: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } } } },
                        { $sort: { n: -1 } }
                    ],
                    byCenter: [
                        { $match: { centerId: { $ne: null } } },
                        { $group: { _id: '$centerId', n: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } } } },
                        { $lookup: { from: 'trainingcenters', localField: '_id', foreignField: '_id', as: 'center' } },
                        { $addFields: { name: { $ifNull: [{ $arrayElemAt: ['$center.name', 0] }, 'Unknown'] } } },
                        { $project: { center: 0 } },
                        { $sort: { n: -1 } }
                    ],
                    byTrainer: [
                        { $match: { trainerId: { $ne: null } } },
                        { $group: { _id: '$trainerId', n: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } } } },
                        { $lookup: { from: 'trainers', localField: '_id', foreignField: '_id', as: 'trainer' } },
                        { $addFields: { name: { $ifNull: [{ $arrayElemAt: ['$trainer.name', 0] }, 'Unknown'] } } },
                        { $project: { trainer: 0 } },
                        { $sort: { n: -1 } }
                    ]
                }
            }
        ]);

        const statusMap = Object.fromEntries((facet.byStatus || []).map(r => [r._id, r.n]));
        const modeMap = Object.fromEntries((facet.byMode || []).map(r => [r._id, r.n]));

        // Not in the brief, but the first thing operations asks for: scheduled
        // sessions whose slot has already passed and nobody has marked.
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const awaitingAttendance = await SkillSession.countDocuments({
            ...match,
            status: 'scheduled',
            scheduledDate: { ...(match.scheduledDate || {}), $lt: todayIso }
        });

        res.json({
            totals: {
                total: facet.total?.[0]?.n || 0,
                pending: statusMap.pending || 0,
                scheduled: statusMap.scheduled || 0,
                completed: statusMap.completed || 0,
                noShow: statusMap.no_show || 0,
                cancelled: statusMap.cancelled || 0,
                reSession: facet.reSessions?.[0]?.n || 0,
                awaitingAttendance
            },
            byMode: { online: modeMap.online || 0, offline: modeMap.offline || 0 },
            byService: facet.byService || [],
            byCenter: facet.byCenter || [],
            byTrainer: facet.byTrainer || []
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getEligibility,
    bookSession,
    getMySessions,
    getSessionById,
    cancelSession,
    getAdminSessions,
    assignSession,
    setMeetingLink,
    markAttendance,
    createReSession,
    getSkillSessionReports,
    resolveSkillConfig,
    normalizeKey
};
