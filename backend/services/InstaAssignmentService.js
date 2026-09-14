const Provider = require('../models/Provider');
const InstaJob = require('../models/InstaJob');
const DistanceChargeService = require('./DistanceChargeService');

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

/** Is the worker inside their declared working hours right now? */
const withinWorkingHours = (provider, now = new Date()) => {
    const wh = provider?.instaWork?.workingHours;
    if (!wh || !wh.start || !wh.end) return true;   // unset means always available

    const toMinutes = (hhmm) => {
        const [h, m] = String(hhmm).split(':').map(Number);
        if (Number.isNaN(h)) return null;
        return h * 60 + (m || 0);
    };
    const start = toMinutes(wh.start);
    const end = toMinutes(wh.end);
    if (start === null || end === null) return true;

    const cur = now.getHours() * 60 + now.getMinutes();
    // An end before the start means the window runs past midnight.
    return end >= start ? (cur >= start && cur <= end) : (cur >= start || cur <= end);
};

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
const findCandidates = async ({ service, supplyModel, location, config, excludeIds = [] }) => {
    const now = new Date();

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

    // How many jobs each candidate is already holding, in one query rather than
    // one per worker.
    const ids = raw.map(p => p._id);
    const activeCounts = new Map();
    if (ids.length) {
        const rows = await InstaJob.aggregate([
            {
                $match: {
                    providerId: { $in: ids },
                    status: { $in: ['ASSIGNED', 'PARTNER_SELECTED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'WORK_STARTED'] }
                }
            },
            { $group: { _id: '$providerId', n: { $sum: 1 } } }
        ]);
        rows.forEach(r => activeCounts.set(String(r._id), r.n));
    }

    const jobLat = location?.coordinates?.[1];
    const jobLng = location?.coordinates?.[0];
    const maxJobs = Math.max(1, Number(config.maxConcurrentJobs) || 1);

    const eligible = [];
    for (const p of raw) {
        if (isRestricted(p, now)) continue;
        if (!withinWorkingHours(p, now)) continue;
        // A stale ping means the app is closed — the worker is not really available.
        if (!hasFreshPing(p, config.pingFreshnessMinutes)) continue;
        if ((activeCounts.get(String(p._id)) || 0) >= maxJobs) continue;

        const pos = positionOf(p, config.pingFreshnessMinutes);
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
            etaMinutes: etaFromDistance(distanceKm, config.etaSpeedKmph),
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
const autoAssignSewak = async ({ service, location, config, excludeIds = [] }) => {
    const candidates = await findCandidates({
        service, supplyModel: 'sewak', location, config, excludeIds
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => sewakScore(a) - sewakScore(b));
    return candidates[0];
};

/**
 * The ranked Partner list the customer chooses from. Ordered nearest-first,
 * which is what someone booking instant work is actually optimising for.
 */
const listPartners = async ({ service, location, config }) => {
    const candidates = await findCandidates({
        service, supplyModel: 'partner', location, config
    });
    candidates.sort((a, b) => {
        const da = a.distanceKm === null ? 999 : a.distanceKm;
        const db = b.distanceKm === null ? 999 : b.distanceKm;
        if (da !== db) return da - db;
        return (b.rating || 0) - (a.rating || 0);
    });
    return candidates.slice(0, Math.max(1, Number(config.maxPartnerResults) || 20));
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
    listPartners
};
