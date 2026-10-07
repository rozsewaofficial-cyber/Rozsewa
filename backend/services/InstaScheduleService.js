/**
 * Time for Insta Work: NOW help vs SCHEDULED help (spec §2, §10, §38).
 *
 * Every job reserves a stretch of its worker's time — a window from its start
 * to start + expected duration + travel buffer. A worker is only offered a
 * job whose window does not overlap ones they already hold, so a job booked
 * for tomorrow no longer blocks them today, and two jobs can never be stacked
 * on the same hours.
 *
 * All clock reasoning is on Indian time, whatever the server's own timezone:
 * working hours and booking slots are entered and read as IST.
 */

const TZ = 'Asia/Kolkata';
const MIN = 60 * 1000;

/** Minutes past IST midnight, and the IST calendar day, of a moment. */
const istParts = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(date));
    const get = (t) => parts.find(p => p.type === t).value;
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0;
    return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + Number(get('minute')) };
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** How long a job is expected to take, in minutes. */
const expectedMinutesFor = (service, quantity, config) => {
    const fallback = Math.max(15, Number(config?.scheduling?.defaultJobMinutes) || 60);
    if (service?.pricingType === 'per_hour') {
        const hours = Number(quantity);
        return Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : fallback;
    }
    return fallback;
};

const bufferMinutes = (config) => Math.max(0, Number(config?.scheduling?.travelBufferMinutes) || 0);

/** The window a new job would reserve. */
const buildWindow = ({ mode, scheduledFor, expectedMinutes, config, now = new Date() }) => {
    const start = mode === 'scheduled' ? new Date(scheduledFor) : new Date(now);
    const end = new Date(start.getTime() + (expectedMinutes + bufferMinutes(config)) * MIN);
    return { mode: mode === 'scheduled' ? 'scheduled' : 'now', start, end, workEnd: new Date(start.getTime() + expectedMinutes * MIN) };
};

/**
 * The window an existing job holds. Jobs saved before windows existed are
 * treated as starting when they were assigned and lasting the default length.
 * A job that is running late still holds its worker until it is over.
 */
const STILL_ON_SITE = ['ON_THE_WAY', 'ARRIVED', 'WORK_STARTED'];
const occupiedWindow = (job, config, now = new Date()) => {
    const start = new Date(job.windowStart || job.assignedAt || job.createdAt || now);
    let end = job.windowEnd
        ? new Date(job.windowEnd)
        : new Date(start.getTime() + ((Number(job.expectedMinutes) || 60) + bufferMinutes(config)) * MIN);
    const running = job.bookingMode !== 'scheduled' || STILL_ON_SITE.includes(job.status);
    if (running && end < now) end = new Date(now.getTime() + bufferMinutes(config) * MIN);
    return { start, end };
};

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/** The window an existing job asks for when it has to be (re)matched. */
const windowOfJob = (job, config, now = new Date()) => {
    const mode = job.bookingMode === 'scheduled' ? 'scheduled' : 'now';
    const expected = Number(job.expectedMinutes) || 60;
    if (mode === 'now') return buildWindow({ mode, expectedMinutes: expected, config, now });
    const start = new Date(job.scheduledFor || job.windowStart || now);
    return buildWindow({ mode, scheduledFor: start, expectedMinutes: expected, config, now });
};

/**
 * Whether a worker may set off for (or arrive at) a scheduled job yet.
 * Returns null when they may, or the earliest moment they may.
 */
const tooEarlyToStart = (job, config, now = new Date()) => {
    if (job.bookingMode !== 'scheduled' || !job.scheduledFor) return null;
    const lead = Math.max(0, Number(config?.scheduling?.startJourneyMinutesBefore) || 0);
    const earliest = new Date(new Date(job.scheduledFor).getTime() - lead * MIN);
    return now < earliest ? earliest : null;
};

/**
 * Checks a requested start time against the admin rules and returns it as a
 * Date: not in the past, at least the lead time ahead, within the booking
 * horizon, and on the slot grid.
 */
const validateScheduledTime = (value, config, now = new Date()) => {
    const sch = config?.scheduling || {};
    if (sch.scheduledEnabled === false) throw httpError(400, 'Scheduled help is not available right now.');
    const at = new Date(value);
    if (!value || isNaN(at)) throw httpError(400, 'Choose a date and time for your booking.');
    const lead = Math.max(0, Number(sch.minLeadMinutes) || 0);
    if (at.getTime() < now.getTime() + lead * MIN) {
        throw httpError(400, `Scheduled help must start at least ${lead} minutes from now.`);
    }
    const days = Math.max(1, Number(sch.maxAdvanceDays) || 7);
    if (at.getTime() > now.getTime() + days * 24 * 60 * MIN) {
        throw httpError(400, `You can book up to ${days} days ahead.`);
    }
    const slot = Number(sch.slotMinutes) || 30;
    if (istParts(at).minutes % slot !== 0 || at.getUTCSeconds() !== 0) {
        throw httpError(400, `Choose a start time on the ${slot}-minute slots.`);
    }
    return at;
};

const toMinutes = (hhmm) => {
    if (!hhmm || !String(hhmm).trim()) return null;   // unset hours
    const [h, m] = String(hhmm).split(':').map(Number);
    if (!Number.isFinite(h)) return null;
    return h * 60 + (Number.isFinite(m) ? m : 0);
};

/** Is an IST minute-of-day inside a working-hours window (which may wrap past midnight)? */
const inHours = (minute, start, end) => (end >= start ? (minute >= start && minute <= end) : (minute >= start || minute <= end));

/**
 * Does a worker's declared working-hours window cover the job — its start
 * and the end of the work itself? Unset hours mean always available.
 */
const coversWindow = (workingHours, window) => {
    const start = toMinutes(workingHours?.start);
    const end = toMinutes(workingHours?.end);
    if (start === null || end === null) return true;
    const a = istParts(window.start);
    const b = istParts(window.workEnd || window.start);
    if (!inHours(a.minutes, start, end) || !inHours(b.minutes, start, end)) return false;
    // A same-day window cannot be crossed overnight by a long job.
    if (end >= start && a.day !== b.day) return false;
    return true;
};

/** Working hours right now, on Indian time. */
const withinHoursNow = (workingHours, now = new Date()) => {
    const start = toMinutes(workingHours?.start);
    const end = toMinutes(workingHours?.end);
    if (start === null || end === null) return true;
    return inHours(istParts(now).minutes, start, end);
};

module.exports = {
    TZ,
    istParts,
    httpError,
    expectedMinutesFor,
    buildWindow,
    occupiedWindow,
    overlaps,
    windowOfJob,
    tooEarlyToStart,
    validateScheduledTime,
    coversWindow,
    withinHoursNow
};
