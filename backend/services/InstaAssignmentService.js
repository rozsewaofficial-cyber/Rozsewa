const Provider = require('../models/Provider');
const InstaJob = require('../models/InstaJob');
const DistanceChargeService = require('./DistanceChargeService');
const Schedule = require('./InstaScheduleService');

/**
 * Worker matching for Insta Work.
 *
 * The two supply models need different answers from the same candidate pool:
 *
 *   Sewak   — managed workforce. The system picks one worker and assigns them;
 *             the customer never chooses.
 *   Partner — open supply. The system returns a ranked list and the customer
 *             chooses for themselves.
 *
 * Both start from the same eligibility filter, so a worker who is ineligible is
 * ineligible either way.
 */

/** Rough ETA from straight-line distance. Shown to the customer, never billed. */
const etaFromDistance = (distanceKm, speedKmph) => {
    const speed = Number(speedKmph) > 0 ? Number(speedKmph) : 20;
    if (distanceKm === null || distanceKm === undefined) return null;
    // A floor of one minute avoids showing "0 min away" for a worker next door.
    return Math.max(1, Math.round((distanceKm / speed) * 60));
};

/** Is the worker's last GPS ping recent enough to treat them as really online? */
const hasFreshPing = (provider, freshnessMinutes) => {
    const pingAt = provider?.instaWork?.lastPingAt;
    if (!pingAt) return false;
    const ageMs = Date.now() - new Date(pingAt).getTime();
    return ageMs <= Math.max(1, Number(freshnessMinutes) || 5) * 60000;
};

/** Best known position: the live ping if fresh, otherwise the profile location. */
const positionOf = (provider, freshnessMinutes) => {
    if (hasFreshPing(provider, freshnessMinutes)) {
        const c = provider.instaWork.lastPing?.coordinates;
        if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) {
            return { lng: c[0], lat: c[1], live: true };
        }
    }
    const c = provider.location?.coordinates;
    if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) {
        return { lng: c[0], lat: c[1], live: false };
    }
    return null;
};

/** The worker's last known position at any age, for jobs booked ahead. */
const lastKnownPosition = (provider) => {
    const c = provider?.instaWork?.lastPing?.coordinates;
    if (Array.isArray(c) && c.length === 2 && (c[0] !== 0 || c[1] !== 0)) return { lng: c[0], lat: c[1], live: false };
    return null;
};

/** Is the worker inside their declared working hours right now (Indian time)? */
const withinWorkingHours = (provider, now = new Date()) =>
    Schedule.withinHoursNow(provider?.instaWork?.workingHours, now);

/** Is this worker currently barred from Insta Work? */
const isRestricted = (provider, now = new Date()) => {
    const iw = provider?.instaWork;
    if (!iw) return true;
    if (iw.disabledByAdmin) return true;
    if (iw.restrictedUntil && new Date(iw.restrictedUntil) > now) return true;
    return false;
};

/**
 * The shared eligibility filter, applied before either supply model ranks
 * anyone. Returns the candidates with their distance and ETA attached.
 */
const findCandidates = async ({ service, supplyModel, location, config, excludeIds = [], window = null }) => {
    const now = new Date();
    // The stretch of time being asked for. NOW help: from now for the default
    // length. SCHEDULED help: the chosen slot (spec 10, 38).
    const want = window || Schedule.buildWindow({
        mode: 'now', expectedMinutes: Schedule.expectedMinutesFor(service, null, config), config, now
    });
    const scheduled = want.mode === 'scheduled';

    const query = {
        providerCategory: supplyModel,
        status: 'verified',
        'instaWork.enabled': true,
        'instaWork.services.serviceId': service._id
    };
    if (excludeIds.length) query._id = { $nin: excludeIds };

    const raw = await Provider.find(query)
        .select('ownerName shopName rating reviewCount completedBookingsCount profileImage mobile location instaWork providerCategory city')
        .lean();

    // How many of each candidate's jobs overlap the requested window, in one
    // query rather than one per worker. A job booked for another time of day
    // no longer counts against them.
    const ids = raw.map(p => p._id);
    const activeCounts = new Map();
    if (ids.length) {
        const held = await InstaJob.find({
            providerId: { $in: ids },
            status: { $in: InstaJob.OCCUPIES_WORKER }
        }).select('providerId status bookingMode windowStart windowEnd expectedMinutes assignedAt createdAt').lean();
        for (const j of held) {
            if (!Schedule.overlaps(Schedule.occupiedWindow(j, config, now), want)) continue;
            const k = String(j.providerId);
            activeCounts.set(k, (activeCounts.get(k) || 0) + 1);
        }
    }

    const jobLat = location?.coordinates?.[1];
    const jobLng = location?.coordinates?.[0];
    const maxJobs = Math.max(1, Number(config.maxConcurrentJobs) || 1);

    const eligible = [];
    for (const p of raw) {
        if (isRestricted(p, now)) continue;
        if (scheduled) {
            // Booked ahead: what matters is the worker's hours at that time,
            // not whether their app happens to be open right now.
            if (!Schedule.coversWindow(p.instaWork?.workingHours, want)) continue;
        } else {
            if (!withinWorkingHours(p, now)) continue;
            // A stale ping means the app is closed — the worker is not really available.
            if (!hasFreshPing(p, config.pingFreshnessMinutes)) continue;
        }
        if ((activeCounts.get(String(p._id)) || 0) >= maxJobs) continue;

        // NOW: where they are. SCHEDULED: their base location, else their
        // last known position — they will travel from wherever they are then.
        const pos = scheduled
            ? (positionOf(p, 0) || lastKnownPosition(p))
            : positionOf(p, config.pingFreshnessMinutes);
        if (!pos) continue;

        let distanceKm = null;
        if (jobLat !== undefined && jobLng !== undefined && (jobLat !== 0 || jobLng !== 0)) {
            distanceKm = DistanceChargeService.calculateDistance(jobLat, jobLng, pos.lat, pos.lng);
            if (distanceKm === null || distanceKm > Number(config.matchRadiusKm)) continue;
        }

        const entry = p.instaWork.services.find(s => String(s.serviceId) === String(service._id));

        eligible.push({
            providerId: p._id,
            name: p.ownerName || p.shopName,
            shopName: p.shopName,
            profileImage: p.profileImage || null,
            rating: p.rating || 0,
            reviewCount: p.reviewCount || 0,
            completedJobs: p.completedBookingsCount || 0,
            providerCategory: p.providerCategory,
            distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
            // An ETA only means something for someone setting off now.
            etaMinutes: scheduled ? null : etaFromDistance(distanceKm, config.etaSpeedKmph),
            rate: Number(entry?.rate) || 0,
            activeJobs: activeCounts.get(String(p._id)) || 0,
            liveLocation: pos.live
        });
    }

    return eligible;
};

/**
 * Ranks a Sewak candidate. Lower is better.
 *
 * Proximity dominates because Insta Work is about someone arriving soon, but
 * rating and current workload break ties so the nearest worker isn't handed
 * every job regardless of how well they perform or how busy they already are.
 */
const sewakScore = (c) => {
    const distance = c.distanceKm === null ? 5 : c.distanceKm;      // unknown ≈ mid-range
    const ratingPenalty = (5 - (c.rating || 0)) * 0.6;
    const loadPenalty = (c.activeJobs || 0) * 3;
    return distance + ratingPenalty + loadPenalty;
};

/**
 * Picks the single Sewak to auto-assign, or null when nobody is eligible.
 * The customer never sees this list — that is the whole point of managed supply.
 */
const autoAssignSewak = async ({ service, location, config, excludeIds = [], window = null }) => {
    const candidates = await findCandidates({
        service, supplyModel: 'sewak', location, config, excludeIds, window
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => sewakScore(a) - sewakScore(b));
    return candidates[0];
};

/**
 * The ranked Partner list the customer chooses from. Ordered nearest-first,
 * which is what someone booking instant work is actually optimising for.
 */
const listPartners = async ({ service, location, config, window = null }) => {
    const candidates = await findCandidates({
        service, supplyModel: 'partner', location, config, window
    });
    candidates.sort((a, b) => {
        const da = a.distanceKm === null ? 999 : a.distanceKm;
        const db = b.distanceKm === null ? 999 : b.distanceKm;
        if (da !== db) return da - db;
        return (b.rating || 0) - (a.rating || 0);
    });
    return candidates.slice(0, Math.max(1, Number(config.maxPartnerResults) || 20));
};

/**
 * Gives a worker to a job, and says whether they were still free to give.
 *
 * Capacity is counted and then acted on, with nothing in between — so two
 * requests arriving together could both be told they had the same person.
 * There is no conditional insert to lean on, so the claim is written first and
 * judged afterwards, by age: a job asks how many others already held this
 * worker before it did. That is deterministic, so two racers never both stand
 * down — the earlier claim keeps them and the later one is refused.
 *
 * Every path that hands out a worker goes through here. Three did it their own
 * way and only one checked.
 */
const claimWorker = async ({ job, providerId, config }) => {
    const InstaJob = require('../models/InstaJob');
    const max = Math.max(1, Number(config?.maxConcurrentJobs) || 1);

    job.providerId = providerId;
    job.assignedAt = new Date();
    await job.save();

    // Only jobs whose time overlaps this one compete for the worker.
    const mine = Schedule.occupiedWindow(job, config);
    const others = await InstaJob.find({
        providerId,
        status: { $in: InstaJob.OCCUPIES_WORKER },
        _id: { $ne: job._id },
        // Jobs from before this field existed are treated as already holding
        // the worker, so an unknown claim time never wins by default.
        $or: [{ assignedAt: null }, { assignedAt: { $lte: job.assignedAt } }]
    }).select('status bookingMode windowStart windowEnd expectedMinutes assignedAt createdAt').lean();
    const aheadOfThis = others.filter(o => Schedule.overlaps(Schedule.occupiedWindow(o, config), mine)).length;

    if (aheadOfThis < max) return { ok: true };

    job.providerId = null;
    job.assignedAt = null;
    return { ok: false, heldBy: aheadOfThis };
};

module.exports = {
    etaFromDistance,
    hasFreshPing,
    positionOf,
    withinWorkingHours,
    isRestricted,
    findCandidates,
    sewakScore,
    autoAssignSewak,
    claimWorker,
    listPartners
};
