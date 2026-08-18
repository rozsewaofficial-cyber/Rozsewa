const TrainingCenter = require('../models/TrainingCenter');
const Trainer = require('../models/Trainer');
const SkillSession = require('../models/SkillSession');

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SEARCH_WINDOW_DAYS = 14;

const normalizeCity = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

const toMinutes = (hhmm) => {
    if (typeof hhmm !== 'string') return NaN;
    const [h, m] = hhmm.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return NaN;
    return h * 60 + m;
};

const toHHMM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const toISODate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const parseISODate = (s) => {
    if (typeof s !== 'string') return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

/** Which band a "HH:mm" slot falls in. */
const bandOf = (hhmm) => {
    const mins = toMinutes(hhmm);
    if (mins < 12 * 60) return 'morning';
    if (mins < 17 * 60) return 'afternoon';
    return 'evening';
};

/**
 * Overlap of the center's and trainer's windows for one weekday.
 * Returns [{ start, end }] in minutes-from-midnight.
 */
const intersectWindows = (centerAvail, trainerAvail, day) => {
    const cw = (centerAvail || []).filter(w => w.day === day);
    const tw = (trainerAvail || []).filter(w => w.day === day);
    if (!cw.length || !tw.length) return [];

    const out = [];
    for (const c of cw) {
        for (const t of tw) {
            const start = Math.max(toMinutes(c.startTime), toMinutes(t.startTime));
            const end = Math.min(toMinutes(c.endTime), toMinutes(t.endTime));
            if (!isNaN(start) && !isNaN(end) && end > start) out.push({ start, end });
        }
    }
    return out;
};

/** Chop windows into back-to-back slots of `duration` minutes. */
const chopIntoSlots = (windows, duration) => {
    const slots = [];
    const step = Number(duration) > 0 ? Number(duration) : 60;
    for (const w of windows) {
        for (let t = w.start; t + step <= w.end; t += step) {
            slots.push(toHHMM(t));
        }
    }
    return [...new Set(slots)].sort();
};

/**
 * Find a center + trainer + date + slot for a session.
 *
 * Pure with respect to Express — the booking controller and the retry cron both
 * call it. Returns null when nothing is available; the caller writes 'pending'.
 */
const allocate = async ({
    sewakCity,
    categoryId,
    mode = 'offline',
    durationMinutes = 60,
    preferredDate,
    preferredTimeOfDay = 'morning'
}) => {
    const centerQuery = { isActive: true, categories: categoryId };
    // Online sessions serve any city, so the city constraint only applies offline.
    if (mode === 'offline') {
        const city = normalizeCity(sewakCity);
        if (!city) return null;
        centerQuery.citiesNormalized = city;
    }

    const centers = await TrainingCenter.find(centerQuery).lean();
    if (!centers.length) return null;

    const startDate = parseISODate(preferredDate) || new Date();
    startDate.setHours(0, 0, 0, 0);

    // Load-balance: fewest currently-booked sessions first, so one center doesn't
    // fill to capacity while the rest sit idle.
    const centerLoads = await SkillSession.aggregate([
        { $match: { centerId: { $in: centers.map(c => c._id) }, status: 'scheduled' } },
        { $group: { _id: '$centerId', n: { $sum: 1 } } }
    ]);
    const centerLoad = new Map(centerLoads.map(r => [String(r._id), r.n]));
    centers.sort((a, b) => (centerLoad.get(String(a._id)) || 0) - (centerLoad.get(String(b._id)) || 0));

    for (const center of centers) {
        const trainers = await Trainer.find({
            isActive: true,
            trainingCenter: center._id,
            categories: categoryId
        }).lean();
        if (!trainers.length) continue;

        const trainerLoads = await SkillSession.aggregate([
            { $match: { trainerId: { $in: trainers.map(t => t._id) }, status: 'scheduled' } },
            { $group: { _id: '$trainerId', n: { $sum: 1 } } }
        ]);
        const trainerLoad = new Map(trainerLoads.map(r => [String(r._id), r.n]));
        trainers.sort((a, b) => (trainerLoad.get(String(a._id)) || 0) - (trainerLoad.get(String(b._id)) || 0));

        for (let offset = 0; offset < SEARCH_WINDOW_DAYS; offset++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + offset);
            const iso = toISODate(date);
            const day = DAYS[date.getDay()];

            // Center-level daily ceiling, checked once per date.
            const centerDayCount = await SkillSession.countDocuments({
                centerId: center._id,
                scheduledDate: iso,
                status: 'scheduled'
            });
            if (centerDayCount >= (center.capacity || 0)) continue;

            for (const trainer of trainers) {
                const windows = intersectWindows(center.availability, trainer.availability, day);
                if (!windows.length) continue;

                let slots = chopIntoSlots(windows, durationMinutes);
                if (!slots.length) continue;

                // The preference ORDERS the slots — it never filters them. Someone who
                // asks for evening and finds none still gets scheduled.
                slots = [
                    ...slots.filter(s => bandOf(s) === preferredTimeOfDay),
                    ...slots.filter(s => bandOf(s) !== preferredTimeOfDay)
                ];

                for (const slot of slots) {
                    const booked = await SkillSession.countDocuments({
                        trainerId: trainer._id,
                        scheduledDate: iso,
                        scheduledTime: slot,
                        status: 'scheduled'
                    });
                    if (booked < (trainer.capacity || 0)) {
                        return {
                            centerId: center._id,
                            trainerId: trainer._id,
                            scheduledDate: iso,
                            scheduledTime: slot
                        };
                    }
                }
            }
        }
    }

    return null;
};

/**
 * Re-check a slot after inserting into it. Two bookings can pass the capacity
 * count before either writes; this catches the loser so the caller can reallocate.
 * See D10 — the rigorous fix is a transaction.
 */
const isOverCapacity = async (session) => {
    if (!session.trainerId || !session.scheduledDate || !session.scheduledTime) return false;
    const trainer = await Trainer.findById(session.trainerId).lean();
    if (!trainer) return true;

    const booked = await SkillSession.find({
        trainerId: session.trainerId,
        scheduledDate: session.scheduledDate,
        scheduledTime: session.scheduledTime,
        status: 'scheduled'
    }).select('_id').sort({ createdAt: 1 }).lean();

    const position = booked.findIndex(b => String(b._id) === String(session._id));
    return position >= (trainer.capacity || 0);
};

module.exports = {
    allocate,
    isOverCapacity,
    normalizeCity,
    bandOf,
    intersectWindows,
    chopIntoSlots,
    toISODate,
    parseISODate,
    toMinutes
};
