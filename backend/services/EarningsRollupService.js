const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const EarningsAnalyticsService = require('./EarningsAnalyticsService');

/**
 * The earnings dashboard, reduced to the handful of buckets it actually draws.
 *
 * Every figure on that screen is a sum or a count over the same set of
 * bookings. The screen used to get there by loading all of them — a year's
 * worth, projected and lean, but still one object per booking in the API's
 * memory — and adding them up in JavaScript. That works until the year gets
 * big: 40,000 bookings is about 52 MB, and it scales straight up from there.
 *
 * This produces the same buckets from the database instead, in one pass.
 *
 * There are two ways to fill the buckets and they must not disagree, so both
 * live here: `foldRows` for a list already in memory (which is what the tests
 * exercise) and `fromDatabase` for the aggregation. `assertAgree` checks one
 * against the other on real data — see scripts/earningsRollupCheck.js.
 */

/** The bucket shape, empty. */
const emptyRollup = () => ({
    totals: {
        gross: 0, commission: 0, payout: 0, travel: 0, refunds: 0,
        coinSubsidy: 0, offerSubsidy: 0, netRevenue: 0, count: 0
    },
    // Keyed by the local calendar day or month, matching how the bins are drawn.
    byBin: {},
    byCategory: {},
    byPartner: {},
    byPayment: { 'Paid Online': { value: 0, count: 0 }, 'Cash on Completion': { value: 0, count: 0 } },
    travel: { total: 0, distance: 0, count: 0, highest: 0, today: 0 },
    travelByDay: {},
    sources: { service: 0, visit: 0, night: 0, holiday: 0, urgent: 0, travel: 0, other: 0 }
});

/** How an extra charge is classified, in the order the screen applies it. */
const EXTRA_BUCKETS = [
    ['visit', 'visit'],
    ['night', 'night'],
    ['holiday', 'holiday'],
    ['urgent', 'urgent'],
    ['travel', 'travel']
];

const classifyExtra = (item) => {
    const lower = (item || '').toLowerCase();
    const hit = EXTRA_BUCKETS.find(([needle]) => lower.includes(needle));
    return hit ? hit[1] : 'other';
};

/**
 * The bin a date falls in, as a stable key.
 *
 * Local calendar, not UTC: the bins the screen draws are local days and
 * months, so a booking at 11pm on the 5th belongs to the 5th here the same way
 * it does there.
 */
const binKey = (date, interval) => EarningsAnalyticsService.binKeyFor(date, interval);

const add = (map, key, fields) => {
    if (!map[key]) map[key] = {};
    Object.entries(fields).forEach(([f, v]) => { map[key][f] = (map[key][f] || 0) + v; });
};

/* ------------------------------------------------------------------ */
/* Filling the buckets from rows already in memory                     */
/* ------------------------------------------------------------------ */

const foldRows = (rows, { interval = 'month', startOfToday, last7DaysStart } = {}) => {
    const r = emptyRollup();
    const today = startOfToday || (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

    rows.forEach(b => {
        const gross = EarningsAnalyticsService.grossValue(b);
        const commission = b.adminCommission || 0;
        const coin = b.commissionSnapshot?.coinSubsidy ?? (b.coinDiscount || 0);
        const offer = b.commissionSnapshot?.offerSubsidy ?? (b.offerSubsidy || 0);
        const subsidy = coin + offer;
        const payout = b.providerPayout > 0 ? b.providerPayout : (gross - commission);
        const travelAmt = b.travelCharge?.amount || 0;
        const refund = (b.paymentStatus === 'refunded' || b.status === 'cancelled') ? (b.totalAmount || 0) : 0;
        const net = commission - subsidy;

        r.totals.gross += gross;
        r.totals.commission += commission;
        r.totals.payout += payout;
        r.totals.travel += travelAmt;
        r.totals.refunds += refund;
        r.totals.coinSubsidy += coin;
        r.totals.offerSubsidy += offer;
        r.totals.netRevenue += net;
        r.totals.count += 1;

        add(r.byBin, binKey(b.createdAt, interval), {
            gross, commission, payout, travel: travelAmt, refunds: refund,
            coinSubsidy: coin, offerSubsidy: offer, netRevenue: net
        });

        const category = b.commissionSnapshot?.bookingCategorySnapshot?.name || b.serviceName || 'Unknown';
        add(r.byCategory, category, { revenue: gross, bookings: 1, commission });

        if (b.providerId) {
            const pid = String(b.providerId._id || b.providerId);
            if (!r.byPartner[pid]) {
                r.byPartner[pid] = {
                    name: b.providerId.shopName || b.providerId.ownerName || 'Partner',
                    avatar: b.providerId.profileImage || '',
                    revenue: 0, bookings: 0, ratingSum: 0, ratingCount: 0
                };
            }
            const p = r.byPartner[pid];
            p.revenue += gross;
            p.bookings += 1;
            if (b.rating > 0) { p.ratingSum += b.rating; p.ratingCount += 1; }
        }

        const mode = b.paymentMode === 'after' ? 'Cash on Completion' : 'Paid Online';
        r.byPayment[mode].value += gross;
        r.byPayment[mode].count += 1;

        if (travelAmt > 0) {
            r.travel.total += travelAmt;
            r.travel.distance += b.travelCharge?.distanceKm || b.travelCharge?.billableDistanceKm || 0;
            r.travel.count += 1;
            if (travelAmt > r.travel.highest) r.travel.highest = travelAmt;
            if (new Date(b.createdAt) >= today) r.travel.today += travelAmt;
        }
        if (last7DaysStart && new Date(b.createdAt) >= last7DaysStart) {
            add(r.travelByDay, binKey(b.createdAt, 'day'), { value: travelAmt });
        }

        // Revenue sources: the extras are split out and whatever is left of the
        // gross is the service itself.
        let bTravel = travelAmt;
        const extras = { visit: 0, night: 0, holiday: 0, urgent: 0, other: 0 };
        (b.extraCharges || []).forEach(ec => {
            const bucket = classifyExtra(ec.item);
            if (bucket === 'travel') bTravel += ec.amount || 0;
            else extras[bucket] += ec.amount || 0;
        });

        const totalExtras = bTravel + extras.visit + extras.night + extras.holiday + extras.urgent + extras.other;
        let bService = gross - totalExtras;
        if (bService < 0) { extras.other += bService; bService = 0; }

        r.sources.service += bService;
        r.sources.visit += extras.visit;
        r.sources.night += extras.night;
        r.sources.holiday += extras.holiday;
        r.sources.urgent += extras.urgent;
        r.sources.travel += bTravel;
        r.sources.other += extras.other;
    });

    return r;
};

/* ------------------------------------------------------------------ */
/* Filling the same buckets from the database                          */
/* ------------------------------------------------------------------ */

/**
 * The timezone the bins are drawn in.
 *
 * binKey above uses the local calendar, so the database has to group by the
 * same one or a booking near midnight lands in a different column depending on
 * which path produced it. Taken from the process rather than hardcoded, so the
 * two agree wherever this runs.
 */
const localZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

/** The per-booking values, as expressions, matching foldRows exactly. */
const exprs = () => {
    const coin = { $ifNull: ['$commissionSnapshot.coinSubsidy', { $ifNull: ['$coinDiscount', 0] }] };
    const offer = { $ifNull: ['$commissionSnapshot.offerSubsidy', { $ifNull: ['$offerSubsidy', 0] }] };
    const gross = EarningsAnalyticsService.grossAggregationExpr();
    const commission = { $ifNull: ['$adminCommission', 0] };
    const travel = { $ifNull: ['$travelCharge.amount', 0] };

    return {
        coin,
        offer,
        gross,
        commission,
        travel,
        subsidy: { $add: [coin, offer] },
        // The fallback adds the subsidy back, because the partner is paid on
        // the pre-discount value.
        payout: {
            $cond: [
                { $gt: [{ $ifNull: ['$providerPayout', 0] }, 0] },
                '$providerPayout',
                { $subtract: [gross, commission] }
            ]
        },
        refund: {
            $cond: [
                { $or: [{ $eq: ['$paymentStatus', 'refunded'] }, { $eq: ['$status', 'cancelled'] }] },
                { $ifNull: ['$totalAmount', 0] },
                0
            ]
        },
        category: {
            $ifNull: [
                '$commissionSnapshot.bookingCategorySnapshot.name',
                { $ifNull: ['$serviceName', 'Unknown'] }
            ]
        },
        distance: {
            $ifNull: ['$travelCharge.distanceKm', { $ifNull: ['$travelCharge.billableDistanceKm', 0] }]
        }
    };
};

/** One extra charge classified the same way classifyExtra does. */
const extraBucketExpr = () => ({
    $let: {
        vars: { lower: { $toLower: { $ifNull: ['$$ec.item', ''] } } },
        in: {
            $switch: {
                branches: EXTRA_BUCKETS.map(([needle, bucket]) => ({
                    case: { $gte: [{ $indexOfCP: ['$$lower', needle] }, 0] },
                    then: bucket
                })),
                default: 'other'
            }
        }
    }
});

/** Per-booking extras, folded into one object of sums. */
const extrasExpr = () => ({
    $reduce: {
        input: { $ifNull: ['$extraCharges', []] },
        initialValue: { visit: 0, night: 0, holiday: 0, urgent: 0, travel: 0, other: 0 },
        in: {
            $let: {
                vars: { ec: '$$this', bucket: null },
                in: {
                    $let: {
                        vars: {
                            b: {
                                $let: {
                                    vars: { lower: { $toLower: { $ifNull: ['$$this.item', ''] } } },
                                    in: {
                                        $switch: {
                                            branches: EXTRA_BUCKETS.map(([needle, bucket]) => ({
                                                case: { $gte: [{ $indexOfCP: ['$$lower', needle] }, 0] },
                                                then: bucket
                                            })),
                                            default: 'other'
                                        }
                                    }
                                }
                            },
                            amt: { $ifNull: ['$$this.amount', 0] }
                        },
                        in: {
                            visit: { $add: ['$$value.visit', { $cond: [{ $eq: ['$$b', 'visit'] }, '$$amt', 0] }] },
                            night: { $add: ['$$value.night', { $cond: [{ $eq: ['$$b', 'night'] }, '$$amt', 0] }] },
                            holiday: { $add: ['$$value.holiday', { $cond: [{ $eq: ['$$b', 'holiday'] }, '$$amt', 0] }] },
                            urgent: { $add: ['$$value.urgent', { $cond: [{ $eq: ['$$b', 'urgent'] }, '$$amt', 0] }] },
                            travel: { $add: ['$$value.travel', { $cond: [{ $eq: ['$$b', 'travel'] }, '$$amt', 0] }] },
                            other: { $add: ['$$value.other', { $cond: [{ $eq: ['$$b', 'other'] }, '$$amt', 0] }] }
                        }
                    }
                }
            }
        }
    }
});

/**
 * The same buckets, computed by the database.
 *
 * One pass, one $facet: every figure the dashboard draws comes back without a
 * single booking document travelling to the API.
 */
const fromDatabase = async (match, { interval = 'month', last7DaysStart, model = Booking } = {}) => {
    const e = exprs();
    const tz = localZone();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // The same granularity binKeyFor uses. normaliseBin strips the zero
    // padding afterwards so the two spellings of a bin meet.
    const BIN_FORMAT = { hour: '%Y-%m-%d-%H', day: '%Y-%m-%d', month: '%Y-%m' };
    const binFormat = BIN_FORMAT[interval] || BIN_FORMAT.month;

    // Everything each branch below needs, worked out once per booking.
    const base = [
        { $match: match },
        {
            $addFields: {
                _gross: e.gross,
                _commission: e.commission,
                _coin: e.coin,
                _offer: e.offer,
                _payout: e.payout,
                _travel: e.travel,
                _refund: e.refund,
                _category: e.category,
                _distance: e.distance,
                _extras: extrasExpr(),
                _bin: { $dateToString: { format: binFormat, date: '$createdAt', timezone: tz } },
                _day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } }
            }
        },
        {
            $addFields: {
                _net: { $subtract: ['$_commission', { $add: ['$_coin', '$_offer'] }] },
                // The travel bucket takes the booking's own travel charge plus
                // any extra line that looks like one.
                _sourceTravel: { $add: ['$_travel', '$_extras.travel'] }
            }
        },
        {
            $addFields: {
                _totalExtras: {
                    $add: ['$_sourceTravel', '$_extras.visit', '$_extras.night', '$_extras.holiday', '$_extras.urgent', '$_extras.other']
                }
            }
        },
        {
            $addFields: {
                // What is left of the gross after the extras is the service
                // itself; if that goes negative the shortfall moves to "other",
                // exactly as the in-memory path does it.
                _rawService: { $subtract: ['$_gross', '$_totalExtras'] }
            }
        },
        {
            $addFields: {
                _service: { $cond: [{ $lt: ['$_rawService', 0] }, 0, '$_rawService'] },
                _other: {
                    $add: ['$_extras.other', { $cond: [{ $lt: ['$_rawService', 0] }, '$_rawService', 0] }]
                }
            }
        },
        {
            // Down to only what the branches below read.
            //
            // $facet hands every input document to every branch, and there is a
            // hard ceiling on how much it may hold. Carrying the original
            // bookings through — snapshots, extra-charge arrays and all —
            // reached it at forty thousand rows. Nothing past this point needs
            // them: the values have already been worked out.
            $project: {
                _id: 0,
                _gross: 1, _commission: 1, _coin: 1, _offer: 1, _payout: 1,
                _travel: 1, _refund: 1, _category: 1, _distance: 1,
                _bin: 1, _day: 1, _net: 1, _sourceTravel: 1, _service: 1, _other: 1,
                _visit: '$_extras.visit',
                _night: '$_extras.night',
                _holiday: '$_extras.holiday',
                _urgent: '$_extras.urgent',
                providerId: 1,
                paymentMode: 1,
                rating: 1,
                createdAt: 1
            }
        }
    ];

    const sums = {
        gross: { $sum: '$_gross' },
        commission: { $sum: '$_commission' },
        payout: { $sum: '$_payout' },
        travel: { $sum: '$_travel' },
        refunds: { $sum: '$_refund' },
        coinSubsidy: { $sum: '$_coin' },
        offerSubsidy: { $sum: '$_offer' },
        netRevenue: { $sum: '$_net' }
    };

    const [facet] = await model.aggregate([
        ...base,
        {
            $facet: {
                totals: [{ $group: { _id: null, ...sums, count: { $sum: 1 } } }],
                byBin: [{ $group: { _id: '$_bin', ...sums } }],
                byCategory: [{
                    $group: {
                        _id: '$_category',
                        revenue: { $sum: '$_gross' },
                        bookings: { $sum: 1 },
                        commission: { $sum: '$_commission' }
                    }
                }],
                byPartner: [
                    { $match: { providerId: { $ne: null } } },
                    {
                        $group: {
                            _id: '$providerId',
                            revenue: { $sum: '$_gross' },
                            bookings: { $sum: 1 },
                            ratingSum: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$rating', 0] }, 0] }, '$rating', 0] } },
                            ratingCount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$rating', 0] }, 0] }, 1, 0] } }
                        }
                    }
                ],
                byPayment: [{
                    $group: {
                        _id: { $cond: [{ $eq: ['$paymentMode', 'after'] }, 'Cash on Completion', 'Paid Online'] },
                        value: { $sum: '$_gross' },
                        count: { $sum: 1 }
                    }
                }],
                travel: [
                    { $match: { _travel: { $gt: 0 } } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$_travel' },
                            distance: { $sum: '$_distance' },
                            count: { $sum: 1 },
                            highest: { $max: '$_travel' },
                            today: { $sum: { $cond: [{ $gte: ['$createdAt', startOfToday] }, '$_travel', 0] } }
                        }
                    }
                ],
                travelByDay: last7DaysStart
                    ? [
                        { $match: { createdAt: { $gte: last7DaysStart } } },
                        { $group: { _id: '$_day', value: { $sum: '$_travel' } } }
                    ]
                    : [],
                sources: [{
                    $group: {
                        _id: null,
                        service: { $sum: '$_service' },
                        visit: { $sum: '$_visit' },
                        night: { $sum: '$_night' },
                        holiday: { $sum: '$_holiday' },
                        urgent: { $sum: '$_urgent' },
                        travel: { $sum: '$_sourceTravel' },
                        other: { $sum: '$_other' }
                    }
                }]
            }
        }
    ]).allowDiskUse(true);

    const r = emptyRollup();
    const one = (arr, fallback) => (arr && arr[0]) || fallback;

    const t = one(facet.totals, {});
    Object.keys(r.totals).forEach(k => { r.totals[k] = t[k] || 0; });

    // The database keys bins as zero-padded strings; the in-memory path keys
    // them by the date parts. Normalised here so the two are comparable.
    //
    // A row with no createdAt gets a null key from $dateToString. It has no bin
    // in either path — the in-memory one would place it in 1970, outside every
    // range a chart draws — so it is skipped rather than crashing on it.
    const normaliseBin = (key) =>
        (typeof key === 'string' ? key.split('-').map(Number).join('-') : null);

    facet.byBin.forEach(row => {
        const k = normaliseBin(row._id);
        if (k === null) return;
        r.byBin[k] = {
            gross: row.gross, commission: row.commission, payout: row.payout,
            travel: row.travel, refunds: row.refunds, coinSubsidy: row.coinSubsidy,
            offerSubsidy: row.offerSubsidy, netRevenue: row.netRevenue
        };
    });

    facet.byCategory.forEach(row => {
        r.byCategory[row._id] = { revenue: row.revenue, bookings: row.bookings, commission: row.commission };
    });

    facet.byPartner.forEach(row => {
        r.byPartner[String(row._id)] = {
            name: null, avatar: null,
            revenue: row.revenue, bookings: row.bookings,
            ratingSum: row.ratingSum, ratingCount: row.ratingCount
        };
    });

    facet.byPayment.forEach(row => {
        r.byPayment[row._id] = { value: row.value, count: row.count };
    });

    const tr = one(facet.travel, {});
    r.travel = {
        total: tr.total || 0, distance: tr.distance || 0, count: tr.count || 0,
        highest: tr.highest || 0, today: tr.today || 0
    };

    (facet.travelByDay || []).forEach(row => {
        const k = normaliseBin(row._id);
        if (k === null) return;
        r.travelByDay[k] = { value: row.value };
    });

    const s = one(facet.sources, {});
    Object.keys(r.sources).forEach(k => { r.sources[k] = s[k] || 0; });

    return r;
};

/**
 * Names for the handful of partners actually shown, fetched after the ranking
 * rather than carried on every booking.
 */
const nameTopPartners = async (rollup, limit = 5) => {
    const ranked = Object.entries(rollup.byPartner).sort((a, b) => b[1].revenue - a[1].revenue);

    // Everyone level with the last place shown, not just the first five.
    //
    // The renderer breaks revenue ties by name, so which partners it picks is
    // not known until they have names — and naming only five left whichever
    // tied partner it chose instead showing as "Partner".
    const cutoff = ranked[limit - 1]?.[1].revenue;
    const top = cutoff === undefined
        ? ranked
        : ranked.filter(([, p]) => p.revenue >= cutoff);

    if (!top.length) return rollup;

    const Provider = require('../models/Provider');
    const rows = await Provider.find({ _id: { $in: top.map(([id]) => id) } })
        .select('shopName ownerName profileImage')
        .lean();
    const byId = new Map(rows.map(p => [String(p._id), p]));

    top.forEach(([id, p]) => {
        const doc = byId.get(id);
        p.name = doc ? (doc.shopName || doc.ownerName || 'Partner') : 'Partner';
        p.avatar = doc?.profileImage || '';
    });

    return rollup;
};

/**
 * Two rollups added together.
 *
 * Insta Work jobs live in their own collection with their own vocabulary, so
 * they are folded in memory by the adapter and added to the booking rollup
 * here rather than being forced into the same aggregation. Adding buckets is
 * safe in a way that merging two pipelines would not be: the shapes are the
 * same by construction, and the totals are sums.
 */
const mergeRollups = (a, b) => {
    const r = emptyRollup();

    Object.keys(r.totals).forEach(k => { r.totals[k] = (a.totals[k] || 0) + (b.totals[k] || 0); });
    Object.keys(r.sources).forEach(k => { r.sources[k] = (a.sources[k] || 0) + (b.sources[k] || 0); });

    r.travel = {
        total: a.travel.total + b.travel.total,
        distance: a.travel.distance + b.travel.distance,
        count: a.travel.count + b.travel.count,
        // The highest single charge across both, not their sum.
        highest: Math.max(a.travel.highest, b.travel.highest),
        today: a.travel.today + b.travel.today
    };

    const mergeMap = (target, x, y, fields) => {
        [x, y].forEach(src => {
            Object.entries(src).forEach(([key, val]) => {
                if (!target[key]) {
                    target[key] = {};
                    fields.forEach(f => { target[key][f] = 0; });
                }
                fields.forEach(f => { target[key][f] = (target[key][f] || 0) + (val[f] || 0); });
            });
        });
    };

    mergeMap(r.byBin, a.byBin, b.byBin,
        ['gross', 'commission', 'payout', 'travel', 'refunds', 'coinSubsidy', 'offerSubsidy', 'netRevenue']);
    mergeMap(r.byCategory, a.byCategory, b.byCategory, ['revenue', 'bookings', 'commission']);
    mergeMap(r.travelByDay, a.travelByDay, b.travelByDay, ['value']);

    // Payment buckets start populated, so they are summed rather than merged.
    Object.keys(r.byPayment).forEach(k => {
        r.byPayment[k] = {
            value: (a.byPayment[k]?.value || 0) + (b.byPayment[k]?.value || 0),
            count: (a.byPayment[k]?.count || 0) + (b.byPayment[k]?.count || 0)
        };
    });

    // Partners carry a name as well as sums, so whichever side has one wins.
    [a.byPartner, b.byPartner].forEach(src => {
        Object.entries(src).forEach(([id, p]) => {
            if (!r.byPartner[id]) {
                r.byPartner[id] = { name: null, avatar: null, revenue: 0, bookings: 0, ratingSum: 0, ratingCount: 0 };
            }
            const t = r.byPartner[id];
            t.name = t.name || p.name;
            t.avatar = t.avatar || p.avatar;
            t.revenue += p.revenue;
            t.bookings += p.bookings;
            t.ratingSum += p.ratingSum;
            t.ratingCount += p.ratingCount;
        });
    });

    return r;
};

module.exports = {
    emptyRollup, foldRows, fromDatabase, mergeRollups, nameTopPartners,
    binKey, classifyExtra, EXTRA_BUCKETS, localZone
};
