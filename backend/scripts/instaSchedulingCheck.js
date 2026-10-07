/**
 * Insta Work NOW vs SCHEDULED help (spec §2, §10, §38).
 *
 * A job reserves a time window on its worker; matching only offers a worker a
 * job whose window does not overlap ones they hold. Scheduled help is checked
 * against the worker's hours AT that time (Indian time), not whether their app
 * is open right now. Booking rules: lead time, horizon, slot grid.
 *
 *   node scripts/instaSchedulingCheck.js
 *
 * Runs the real services with the models stubbed; no database needed.
 */
const assert = require('assert');
const mongoose = require('mongoose');
const S = require('../services/InstaScheduleService');
const Provider = require('../models/Provider');
const InstaJob = require('../models/InstaJob');
const A = require('../services/InstaAssignmentService');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const config = {
    maxConcurrentJobs: 1, matchRadiusKm: 10, pingFreshnessMinutes: 5, etaSpeedKmph: 20,
    scheduling: { scheduledEnabled: true, minLeadMinutes: 60, maxAdvanceDays: 7, slotMinutes: 30, travelBufferMinutes: 30, defaultJobMinutes: 60, startJourneyMinutesBefore: 120 }
};
const IST = (s) => new Date(`${s}+05:30`);
const NOW = IST('2026-10-07T10:07:00');
const id = () => new mongoose.Types.ObjectId();

(async () => {
    await check('scheduled time: lead time, horizon and slot grid are enforced (Indian time)', async () => {
        assert.throws(() => S.validateScheduledTime(IST('2026-10-07T10:30:00'), config, NOW), /at least 60 minutes/);
        assert.throws(() => S.validateScheduledTime(IST('2026-10-20T10:00:00'), config, NOW), /up to 7 days/);
        assert.throws(() => S.validateScheduledTime(IST('2026-10-08T10:15:00'), config, NOW), /30-minute slots/);
        assert.throws(() => S.validateScheduledTime('nonsense', config, NOW), /Choose a date/);
        assert.strictEqual(S.validateScheduledTime(IST('2026-10-08T10:30:00'), config, NOW).toISOString(), IST('2026-10-08T10:30:00').toISOString());
        assert.throws(() => S.validateScheduledTime(IST('2026-10-08T10:30:00'), { scheduling: { ...config.scheduling, scheduledEnabled: false } }, NOW), /not available/);
    });

    await check('expected length: hours booked for hourly work, the default otherwise', async () => {
        assert.strictEqual(S.expectedMinutesFor({ pricingType: 'per_hour' }, 2, config), 120);
        assert.strictEqual(S.expectedMinutesFor({ pricingType: 'per_unit' }, 5, config), 60);
    });

    await check('working hours are read on Indian time, including shifts past midnight', async () => {
        const day = { start: '09:00', end: '18:00' };
        const w = (start, mins) => S.buildWindow({ mode: 'scheduled', scheduledFor: IST(start), expectedMinutes: mins, config });
        assert.ok(S.coversWindow(day, w('2026-10-08T10:00:00', 120)));
        assert.ok(!S.coversWindow(day, w('2026-10-08T17:00:00', 120)), 'work would run past 18:00');
        assert.ok(!S.coversWindow(day, w('2026-10-08T08:00:00', 60)), 'starts before 09:00');
        assert.ok(S.coversWindow({ start: '22:00', end: '06:00' }, w('2026-10-08T23:00:00', 120)), 'overnight shift');
        assert.ok(S.coversWindow({}, w('2026-10-08T03:00:00', 60)), 'unset hours = always');
        assert.ok(S.withinHoursNow(day, IST('2026-10-07T10:07:00')));
        assert.ok(!S.withinHoursNow(day, IST('2026-10-07T20:00:00')));
    });

    await check('windows: a job tomorrow does not overlap now; a running-late job still holds its worker', async () => {
        const nowWin = S.buildWindow({ mode: 'now', expectedMinutes: 60, config, now: NOW });
        const tomorrow = { bookingMode: 'scheduled', status: 'ACCEPTED', windowStart: IST('2026-10-08T10:00:00'), windowEnd: IST('2026-10-08T11:30:00') };
        assert.ok(!S.overlaps(S.occupiedWindow(tomorrow, config, NOW), nowWin));
        const late = { bookingMode: 'now', status: 'WORK_STARTED', windowStart: IST('2026-10-07T07:00:00'), windowEnd: IST('2026-10-07T08:30:00') };
        assert.ok(S.overlaps(S.occupiedWindow(late, config, NOW), nowWin), 'still on site, still busy');
        const soon = { bookingMode: 'scheduled', status: 'ACCEPTED', windowStart: IST('2026-10-07T10:30:00'), windowEnd: IST('2026-10-07T12:00:00') };
        assert.ok(S.overlaps(S.occupiedWindow(soon, config, NOW), nowWin), 'a scheduled job starting in 23 min blocks a 60-min NOW job');
    });

    await check('a worker may not set off hours before a scheduled job', async () => {
        const job = { bookingMode: 'scheduled', scheduledFor: IST('2026-10-07T15:00:00') };
        assert.ok(S.tooEarlyToStart(job, config, NOW), 'five hours early');
        assert.strictEqual(S.tooEarlyToStart(job, config, IST('2026-10-07T13:30:00')), null);
        assert.strictEqual(S.tooEarlyToStart({ bookingMode: 'now' }, config, NOW), null);
    });

    await check('cancelling scheduled help well ahead is free; close to its time the stage fees apply', async () => {
        const stage = (over) => InstaJob.schema.methods.cancellationStageNow.call(
            { bookingMode: 'scheduled', status: 'ACCEPTED', scheduledFor: IST('2026-10-08T10:00:00'), ...over },
            { freeCancelMinutesBefore: 120, now: NOW.getTime() });
        assert.strictEqual(stage({}), 'scheduledInAdvance', 'a day ahead');
        assert.strictEqual(stage({ scheduledFor: IST('2026-10-07T11:00:00') }), 'afterAcceptance', '53 minutes ahead');
        assert.strictEqual(stage({ status: 'ON_THE_WAY' }), 'afterAcceptance', 'worker already travelling');
        assert.strictEqual(InstaJob.schema.methods.cancellationStageNow.call({ bookingMode: 'now', status: 'ACCEPTED' }, { freeCancelMinutesBefore: 120 }), 'afterAcceptance', 'NOW help unchanged');
    });

    // ---- matching with stubbed models ----
    const service = { _id: id(), pricingType: 'per_hour' };
    const at = [75.8577, 22.7196];
    const worker = (over = {}) => ({
        _id: id(), ownerName: 'W', rating: 4, providerCategory: 'sewak', location: { coordinates: at },
        instaWork: { enabled: true, services: [{ serviceId: service._id, rate: 0 }], lastPingAt: new Date(), lastPing: { coordinates: at }, workingHours: { start: '', end: '' }, ...over }
    });
    let providers = [];
    let held = [];
    Provider.find = () => ({ select: () => ({ lean: async () => providers }) });
    InstaJob.find = (q) => ({ select: () => ({ lean: async () => held.filter(j => !q.providerId?.$in || q.providerId.$in.some(x => String(x) === String(j.providerId))) }) });
    const location = { type: 'Point', coordinates: at };
    const nowWin = S.buildWindow({ mode: 'now', expectedMinutes: 60, config });
    const slot = S.buildWindow({ mode: 'scheduled', scheduledFor: new Date(Date.now() + 26 * 3600e3), expectedMinutes: 120, config });

    await check('NOW help: a worker whose only job is tomorrow is offered; one busy right now is not', async () => {
        const free = worker(); const busy = worker();
        providers = [free, busy];
        held = [
            { providerId: free._id, status: 'ACCEPTED', bookingMode: 'scheduled', windowStart: new Date(Date.now() + 24 * 3600e3), windowEnd: new Date(Date.now() + 25.5 * 3600e3) },
            { providerId: busy._id, status: 'WORK_STARTED', bookingMode: 'now', windowStart: new Date(Date.now() - 1800e3), windowEnd: new Date(Date.now() + 1800e3) }
        ];
        const ids = (await A.findCandidates({ service, supplyModel: 'sewak', location, config, window: nowWin })).map(c => String(c.providerId));
        assert.deepStrictEqual(ids, [String(free._id)]);
    });

    await check('SCHEDULED help: needs working hours then, not an open app now; overlapping workers are skipped', async () => {
        const offline = worker({ lastPingAt: new Date(Date.now() - 3 * 3600e3) });   // app closed now
        const clash = worker();
        const offHours = worker({ workingHours: { start: '01:00', end: '02:00' } });
        providers = [offline, clash, offHours];
        held = [{ providerId: clash._id, status: 'ACCEPTED', bookingMode: 'scheduled', windowStart: new Date(slot.start.getTime() + 3600e3), windowEnd: new Date(slot.start.getTime() + 2 * 3600e3) }];
        const got = await A.findCandidates({ service, supplyModel: 'sewak', location, config, window: slot });
        assert.deepStrictEqual(got.map(c => String(c.providerId)), [String(offline._id)]);
        assert.strictEqual(got[0].etaMinutes, null, 'no ETA for a job booked ahead');
        const nowGot = await A.findCandidates({ service, supplyModel: 'sewak', location, config, window: nowWin });
        assert.ok(!nowGot.some(c => String(c.providerId) === String(offline._id)), 'but not offered NOW help while offline');
    });

    await check('the claim only competes with jobs that overlap it', async () => {
        const w = id();
        const job = { _id: id(), bookingMode: 'scheduled', status: 'ASSIGNED', windowStart: slot.start, windowEnd: slot.end, save: async () => {} };
        held = [{ providerId: w, status: 'WORK_STARTED', bookingMode: 'now', windowStart: new Date(Date.now() - 1800e3), windowEnd: new Date(Date.now() + 1800e3), assignedAt: new Date(Date.now() - 1800e3) }];
        InstaJob.find = () => ({ select: () => ({ lean: async () => held }) });
        assert.ok((await A.claimWorker({ job, providerId: w, config })).ok, 'busy now, free tomorrow: claim succeeds');
        held.push({ providerId: w, status: 'ACCEPTED', bookingMode: 'scheduled', windowStart: slot.start, windowEnd: slot.end, assignedAt: new Date(Date.now() - 60e3) });
        assert.ok(!(await A.claimWorker({ job, providerId: w, config })).ok, 'same slot already held: claim refused');
        assert.strictEqual(job.providerId, null, 'the loser lets the worker go');
    });

    console.log(`\n${passed} Insta scheduling checks passed.\n`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
