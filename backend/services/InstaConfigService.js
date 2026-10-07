const Setting = require('../models/Setting');

const CONFIG_KEY = 'insta_work_config';

/**
 * Platform-wide Insta Work settings, stored in the same key/value `Setting`
 * collection the night-charge, cash-limit and coin configs use.
 *
 * These are the shipping defaults; everything is admin-editable at runtime.
 */
const DEFAULT_CONFIG = {
    enabled: true,

    // Billing blocks for hourly work. The spec allows 15, 30 or 60 minutes.
    billingIntervalMinutes: 30,

    // A worker who has arrived waits this long free of charge before the
    // waiting clock starts.
    arrivalGraceMinutes: 10,
    idleChargePerMinute: 2,

    // How far past the booked duration a job may run before the worker must
    // ask the customer to approve an extension.
    overrunThresholdMinutes: 30,
    // How long the customer has to answer before the request lapses.
    extensionResponseMinutes: 10,

    // How long a finished job waits for the customer to confirm it before the
    // platform confirms it for them. Until this existed, a customer who simply
    // closed the app left the job — and the worker's money — stranded with no
    // way out for either side. Zero switches it off.
    autoConfirmHours: 24,

    // A GPS ping older than this means the worker is treated as offline and is
    // not offered jobs, however their toggle is set.
    pingFreshnessMinutes: 5,

    // Radius the matching engine searches, and how many Partners to show.
    matchRadiusKm: 10,
    maxPartnerResults: 20,
    // Rough city-traffic speed, used only to turn distance into a shown ETA.
    etaSpeedKmph: 20,

    // How many active jobs a worker may hold before matching skips them.
    maxConcurrentJobs: 1,

    /**
     * NOW vs SCHEDULED help. A job occupies its worker for a time window —
     * start to start + expected duration + travel buffer — and a worker is
     * only offered a job whose window does not overlap one they already hold.
     */
    scheduling: {
        scheduledEnabled: true,
        // Earliest a scheduled job may start, from the moment of booking.
        minLeadMinutes: 60,
        // How far ahead a customer may book.
        maxAdvanceDays: 7,
        // Bookable start times fall on this grid (e.g. 10:00, 10:30, ...).
        slotMinutes: 30,
        // Gap kept between one job's end and the next one's start.
        travelBufferMinutes: 30,
        // Expected length of a job that is not booked by the hour.
        defaultJobMinutes: 60,
        // Reminder to customer and worker before a scheduled job.
        reminderMinutesBefore: 60,
        // How early a worker may set off for a scheduled job.
        startJourneyMinutesBefore: 120,
        // Keep re-matching an unassigned scheduled job until this close to it.
        stopMatchingMinutesBefore: 30,
        // A customer may cancel scheduled help free of charge until this close
        // to its start; after that the normal stage fees apply.
        freeCancelMinutesBefore: 120
    },

    /**
     * Cancellation fees by how far the job had progressed. A flat rupee amount
     * per stage keeps it predictable for the customer.
     */
    cancellationFees: {
        beforeAcceptance: 0,
        afterAcceptance: 30,
        afterArrival: 60,
        workStarted: 100
    },

    /**
     * Escalation for repeated cancellations, counted over a rolling window.
     */
    cancellationPolicy: {
        windowDays: 7,
        warnAfter: 2,
        restrictAfter: 3,
        restrictionHours: 24,
        disableAfter: 5
    }
};

const deepDefault = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
    if (fallback && typeof fallback === 'object') {
        const merged = { ...fallback };
        for (const key of Object.keys(fallback)) merged[key] = deepDefault(value[key], fallback[key]);
        return merged;
    }
    return value;
};

/** Always returns a fully-populated config, even if the row is absent. */
const getConfig = async () => {
    try {
        const row = await Setting.findOne({ key: CONFIG_KEY }).lean();
        if (!row || !row.value) return deepDefault({}, DEFAULT_CONFIG);
        const raw = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        return deepDefault(raw, DEFAULT_CONFIG);
    } catch (err) {
        console.error('[InstaWork] Failed to read config, using defaults:', err.message);
        return deepDefault({}, DEFAULT_CONFIG);
    }
};

const saveConfig = async (partial) => {
    const current = await getConfig();
    const next = deepDefault(partial, current);

    // The spec fixes the permitted billing blocks; anything else would make the
    // rounding example in the contract meaningless.
    if (![15, 30, 60].includes(Number(next.billingIntervalMinutes))) {
        throw new Error('Billing interval must be 15, 30 or 60 minutes.');
    }
    next.billingIntervalMinutes = Number(next.billingIntervalMinutes);

    if (Number(next.arrivalGraceMinutes) < 0) throw new Error('Arrival grace period cannot be negative.');
    if (Number(next.idleChargePerMinute) < 0) throw new Error('Waiting charge cannot be negative.');
    if (Number(next.matchRadiusKm) <= 0) throw new Error('Match radius must be greater than zero.');

    // Confirming on the customer's behalf the moment the timer stops would give
    // them no chance to dispute the bill at all, so this is either off or a
    // real window.
    const autoConfirm = Number(next.autoConfirmHours);
    if (isNaN(autoConfirm) || autoConfirm < 0) {
        throw new Error('Auto-confirm hours cannot be negative.');
    }
    if (autoConfirm > 0 && autoConfirm < 1) {
        throw new Error('Auto-confirm must give the customer at least an hour, or be 0 to switch it off.');
    }
    next.autoConfirmHours = autoConfirm;

    const sch = next.scheduling;
    for (const k of ['minLeadMinutes', 'travelBufferMinutes', 'reminderMinutesBefore', 'startJourneyMinutesBefore', 'stopMatchingMinutesBefore', 'freeCancelMinutesBefore']) {
        const v = Number(sch[k]);
        if (!Number.isFinite(v) || v < 0) throw new Error(`Scheduling: ${k} cannot be negative.`);
        sch[k] = v;
    }
    sch.maxAdvanceDays = Number(sch.maxAdvanceDays);
    if (!(sch.maxAdvanceDays >= 1 && sch.maxAdvanceDays <= 60)) throw new Error('Scheduling: customers must be able to book between 1 and 60 days ahead.');
    sch.slotMinutes = Number(sch.slotMinutes);
    if (![15, 30, 60].includes(sch.slotMinutes)) throw new Error('Scheduling: time slots must be 15, 30 or 60 minutes.');
    sch.defaultJobMinutes = Number(sch.defaultJobMinutes);
    if (!(sch.defaultJobMinutes >= 15)) throw new Error('Scheduling: default job length must be at least 15 minutes.');
    sch.scheduledEnabled = sch.scheduledEnabled !== false;

    await Setting.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value: next, updatedAt: new Date() },
        { upsert: true }
    );
    return next;
};

module.exports = { CONFIG_KEY, DEFAULT_CONFIG, getConfig, saveConfig };
