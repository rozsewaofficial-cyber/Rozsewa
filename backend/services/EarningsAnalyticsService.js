const Booking = require('../models/Booking');
const Withdrawal = require('../models/Withdrawal');

class EarningsAnalyticsService {

    /**
     * What a platform-funded discount took off this booking.
     *
     * Coins and Offers are paid for by RozSewa, not conceded by the partner, so
     * they are a marketing cost rather than a smaller job.
     */
    static platformSubsidy(b) {
        const coin = b.commissionSnapshot?.coinSubsidy ?? (b.coinDiscount || 0);
        const offer = b.commissionSnapshot?.offerSubsidy ?? (b.offerSubsidy || 0);
        return coin + offer;
    }

    /**
     * The value of the work done, which is what every "revenue" and "sales"
     * figure on the dashboard means.
     *
     * Not the cash the customer handed over: commission is charged on this and
     * the partner is paid from it, so using the discounted price instead left
     * the category table and the trend line disagreeing with the GMV headline
     * above them. Matches grossOrderAmount in the settlement engine.
     */
    static grossValue(b) {
        return (b.totalAmount || 0) + this.platformSubsidy(b);
    }

    /**
     * grossValue as a MongoDB expression, for callers that total revenue in
     * an aggregation rather than in memory.
     *
     * It exists so the database and the in-memory path cannot drift into two
     * different answers to "what did we sell".
     */
    static grossAggregationExpr() {
        const subsidy = (snapshotField, legacyField) => ({
            $ifNull: [`$commissionSnapshot.${snapshotField}`, { $ifNull: ['$' + legacyField, 0] }]
        });
        return {
            $add: [
                { $ifNull: ["$totalAmount", 0] },
                subsidy('coinSubsidy', 'coinDiscount'),
                subsidy('offerSubsidy', 'offerSubsidy')
            ]
        };
    }
    /**
     * Parses dates and returns start/end dates for current and previous periods
     */
    static getPeriodDates(range, startDate, endDate) {
        let currentStart = new Date();
        let currentEnd = new Date();
        let interval = 'day';

        if (startDate && endDate) {
            currentStart = new Date(startDate);
            currentEnd = new Date(endDate);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd.setHours(23, 59, 59, 999);
        } else {
            currentEnd.setHours(23, 59, 59, 999);
            switch (range) {
                case 'today':
                    currentStart.setHours(0, 0, 0, 0);
                    // By the hour. A single day binned by day is one column,
                    // which tells you the total you can already read off the
                    // card above it; the point of looking at today is seeing
                    // when in it the work happened.
                    interval = 'hour';
                    break;
                case '7d':
                    currentStart.setDate(currentStart.getDate() - 6);
                    currentStart.setHours(0, 0, 0, 0);
                    interval = 'day';
                    break;
                case '90d':
                    currentStart.setDate(currentStart.getDate() - 89);
                    currentStart.setHours(0, 0, 0, 0);
                    interval = 'day';
                    break;
                case 'year':
                case '12m':
                    currentStart.setFullYear(currentStart.getFullYear() - 1);
                    currentStart.setDate(currentStart.getDate() + 1);
                    currentStart.setHours(0, 0, 0, 0);
                    interval = 'month';
                    break;
                case '30d':
                default:
                    currentStart.setDate(currentStart.getDate() - 29);
                    currentStart.setHours(0, 0, 0, 0);
                    interval = 'day';
                    break;
            }
        }

        // Calculate previous period of equal length
        const diffMs = currentEnd.getTime() - currentStart.getTime();
        const prevStart = new Date(currentStart.getTime() - diffMs - 1);
        const prevEnd = new Date(currentStart.getTime() - 1);

        return { currentStart, currentEnd, prevStart, prevEnd, interval };
    }

    /**
     * Helper to group data into day-by-day or month-by-month bins for sparklines and trends
     */
    /**
     * The empty bins a chart draws, in order, each with the key that identifies
     * it in a rollup.
     *
     * Split out from binData because the bins are a property of the date range
     * alone — not of the rows — so they can be drawn once and filled from
     * either an in-memory list or a database rollup.
     */
    static binSeries(startDate, endDate, interval) {
        const bins = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        // Start the cursor at the beginning of its own bin.
        //
        // Stepping a month at a time from mid-month walked past the last one:
        // a year ending 14 September started on the 15th, so the cursor went
        // Sep 15, Oct 15 … Aug 15, and the next step overshot the end. There
        // was no September bin, while September's bookings still keyed
        // themselves to one — so that month's revenue was dropped from the
        // chart without appearing anywhere as missing.
        if (interval === 'month') current.setDate(1);
        if (interval === 'month' || interval === 'day') current.setHours(0, 0, 0, 0);
        else if (interval === 'hour') current.setMinutes(0, 0, 0);

        const LABEL = {
            hour: (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }),
            day: (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
            month: (d) => d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        };
        const label = LABEL[interval] || LABEL.month;

        while (current <= end) {
            bins.push({
                // What the chart shows.
                date: label(current),
                // What the rollup keys it by — the same key binKey builds.
                key: this.binKeyFor(current, interval)
            });

            if (interval === 'hour') current.setHours(current.getHours() + 1);
            else if (interval === 'day') current.setDate(current.getDate() + 1);
            else current.setMonth(current.getMonth() + 1);
        }

        return bins;
    }

    /**
     * The bin key for a moment, by local calendar.
     *
     * One definition, used by the bins a chart draws and by both paths that
     * fill them — otherwise a row can land in a bin nothing looks for.
     */
    static binKeyFor(date, interval) {
        const d = new Date(date);
        if (interval === 'hour') {
            return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
        }
        if (interval === 'day') {
            return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        }
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
    }

    /**
     * One series, filled from a rollup's bins.
     *
     * This used to search the bin list once per booking — `bins.find()` inside
     * a loop over every row — and the overview called it nine times over the
     * same data. Ninety days of bins and fifty thousand bookings was forty
     * million date comparisons to draw one card. It is a lookup now.
     */
    static binFromRollup(byBin, startDate, endDate, interval, field) {
        return this.binSeries(startDate, endDate, interval).map(({ date, key }) => ({
            date,
            value: Math.round(((byBin[key]?.[field]) || 0) * 100) / 100
        }));
    }

    static binData(bookings, startDate, endDate, interval, sumFieldGetter) {
        // Bin the rows once into a map, then read each bin off it.
        const byKey = {};
        bookings.forEach(b => {
            const key = this.binKeyFor(b.createdAt, interval);
            byKey[key] = (byKey[key] || 0) + sumFieldGetter(b);
        });

        return this.binSeries(startDate, endDate, interval).map(({ date, key }) => ({
            date,
            value: Math.round((byKey[key] || 0) * 100) / 100
        }));
    }

    /**
     * Executive KPI Overview
     */
    static getOverviewStats(currentBookings, prevBookings, currentWithdrawals, prevWithdrawals, currentStart, currentEnd, prevStart, prevEnd, interval) {
        const R = this._rollup();
        return this.overviewFromRollup(
            R.foldRows(currentBookings, { interval }),
            R.foldRows(prevBookings, { interval }),
            currentWithdrawals,
            prevWithdrawals,
            currentStart,
            currentEnd,
            interval
        );
    }

    /**
     * Revenue Trend Points
     */
    static getRevenueTrend(currentBookings, currentStart, currentEnd, interval) {
        const R = this._rollup();
        return this.revenueTrendFromRollup(R.foldRows(currentBookings, { interval }), currentStart, currentEnd, interval);
    }

    /**
     * Commission Trend Points
     */
    static getCommissionTrend(currentBookings, currentStart, currentEnd, interval) {
        const R = this._rollup();
        return this.commissionTrendFromRollup(R.foldRows(currentBookings, { interval }), currentStart, currentEnd, interval);
    }

    /**
     * Revenue Sources breakdown
     */
    static getRevenueSources(currentBookings) {
        const R = this._rollup();
        return this.revenueSourcesFromRollup(R.foldRows(currentBookings));
    }

    /**
     * Category Breakdown statistics
     */
    static getCategoryBreakdown(currentBookings) {
        const R = this._rollup();
        return this.categoryBreakdownFromRollup(R.foldRows(currentBookings));
    }

    /**
     * Travel charge analytics
     */
    static getTravelAnalytics(currentBookings, currentStart, currentEnd) {
        const R = this._rollup();
        const last7DaysStart = new Date(currentEnd);
        last7DaysStart.setDate(last7DaysStart.getDate() - 6);
        last7DaysStart.setHours(0, 0, 0, 0);
        return this.travelAnalyticsFromRollup(
            R.foldRows(currentBookings, { last7DaysStart }),
            currentEnd
        );
    }

    /**
     * Settlement Analytics
     */
    static getSettlementAnalytics(currentWithdrawals) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        let paidToday = 0;
        let pending = 0;
        let processing = 0;
        let failed = 0;
        let durationSumMs = 0;
        let countDuration = 0;
        const pendingPartners = new Set();

        currentWithdrawals.forEach(w => {
            if (w.status === 'approved') {
                const updateDate = new Date(w.updatedAt || w.createdAt);
                if (updateDate >= startOfToday) {
                    paidToday += w.amount || 0;
                }
                const duration = new Date(w.updatedAt).getTime() - new Date(w.createdAt).getTime();
                if (duration > 0) {
                    durationSumMs += duration;
                    countDuration += 1;
                }
            } else if (w.status === 'pending') {
                pending += w.amount || 0;
                if (w.providerId) {
                    pendingPartners.add(w.providerId.toString());
                }
            } else if (w.status === 'processing') {
                processing += w.amount || 0;
            } else if (w.status === 'rejected') {
                failed += w.amount || 0;
            }
        });

        const avgSettlementTime = countDuration > 0
            ? `${(durationSumMs / (1000 * 60 * 60 * countDuration)).toFixed(1)} hours`
            : '4.0 hours';

        return {
            paidToday: Math.round(paidToday * 100) / 100,
            pending: Math.round(pending * 100) / 100,
            processing: Math.round(processing * 100) / 100,
            failed: Math.round(failed * 100) / 100,
            avgSettlementTime,
            pendingPartnersCount: pendingPartners.size
        };
    }

    /**
     * Payment Methods Analytics
     */
    /**
     * How customers paid.
     *
     * Only two things are actually known: whether the money came in up front or
     * was collected on completion. This used to report a UPI / Card / Wallet /
     * Net Banking split as well — assigned by hashing the booking id. It looked
     * like analytics and was invented, so a decision made on it would have been
     * made on nothing. The instrument is not captured anywhere, so until it is,
     * this reports what is true.
     */
    static getPaymentAnalytics(currentBookings) {
        const R = this._rollup();
        return this.paymentAnalyticsFromRollup(R.foldRows(currentBookings));
    }

    /**
     * Top Partners
     */
    static getTopPartners(currentBookings) {
        const R = this._rollup();
        return this.topPartnersFromRollup(R.foldRows(currentBookings));
    }

    /**
     * Top Categories and their growth
     */
    static getTopCategories(currentBookings, prevBookings) {
        const R = this._rollup();
        return this.topCategoriesFromRollup(R.foldRows(currentBookings), R.foldRows(prevBookings));
    }

    /**
     * Formats transactional ledger including bookings, refunds, payouts, travel charges
     */
    /**
     * The options the earnings filters offer, taken from the whole ledger.
     *
     * Derived here, before the ledger is cut down to the rows the table shows,
     * so narrowing the response does not quietly narrow the dropdowns with it.
     */
    static getFilterOptions(transactions, categories = []) {
        const categorySet = new Set();
        const partners = new Map();
        const citySet = new Set();

        transactions.forEach(t => {
            if (t.category && t.category !== 'Settlement') categorySet.add(t.category);
            if (t.partner && t.partner.name !== 'Partner' && t.partner.name !== 'N/A') {
                const id = t.partner.id && t.partner.id !== 'N/A' ? t.partner.id : t.partner.name;
                partners.set(id, { id, name: t.partner.name });
            }
            if (t.city) citySet.add(t.city);
        });

        // A period of nothing but settlements has no categories in the ledger.
        if (categorySet.size === 0) categories.forEach(c => categorySet.add(c.category));

        return {
            categories: Array.from(categorySet),
            partners: Array.from(partners.values()),
            cities: Array.from(citySet)
        };
    }

    static getRecentTransactions(currentBookings, currentWithdrawals) {
        const txns = [];

        currentBookings.forEach(b => {
            const customerName = b.userId?.name || 'Customer';
            const customerAvatar = b.userId?.profileImage || '';
            const partnerName = b.providerId?.shopName || b.providerId?.ownerName || 'Partner';
            const partnerAvatar = b.providerId?.profileImage || '';
            const category = b.serviceName || 'Service';
            
            // The same invention as the payment split had: a UPI / Card / Wallet
            // / Net Banking label picked by hashing the booking id. On a ledger
            // row it is worse than on a chart, because it reads as a record of
            // how that particular customer paid. The instrument is not stored,
            // so the row says only what is known.
            const method = b.paymentMode === 'after' ? 'Cash on Completion' : 'Paid Online';

            const dateStr = new Date(b.createdAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            // Commission transaction
            if (b.adminCommission > 0 || b.totalAmount > 0) {
                txns.push({
                    id: `TXN-${b._id.toString().slice(-6).toUpperCase()}`,
                    bookingId: `BK-${b._id.toString().slice(-6).toUpperCase()}`,
                    customer: { name: customerName, avatar: customerAvatar },
                    partner: { id: b.providerId?._id?.toString() || 'N/A', name: partnerName, avatar: partnerAvatar },
                    category,
                    city: b.providerId?.city || '',
                    paymentMethod: method,
                    transactionType: (b.paymentStatus === 'refunded' || b.status === 'cancelled') ? 'Refund' : 'Commission',
                    amount: Math.round(b.adminCommission * 100) / 100,
                    // Coin discount RozSewa funded on this booking, and the
                    // commission net of it — so a row whose commission was
                    // wholly eaten by a discount is visible as such.
                    coinSubsidy: Math.round((b.commissionSnapshot?.coinSubsidy ?? (b.coinDiscount || 0)) * 100) / 100,
                    netAmount: Math.round(((b.adminCommission || 0) - (b.commissionSnapshot?.coinSubsidy ?? (b.coinDiscount || 0))) * 100) / 100,
                    status: (b.paymentStatus === 'refunded' || b.status === 'cancelled') ? 'failed' : b.paymentStatus === 'paid' ? 'success' : 'pending',
                    date: dateStr,
                    rawDate: b.createdAt
                });
            }

            // Travel charge transaction if present
            if (b.travelCharge?.amount > 0) {
                txns.push({
                    id: `TVL-${b._id.toString().slice(-6).toUpperCase()}`,
                    bookingId: `BK-${b._id.toString().slice(-6).toUpperCase()}`,
                    customer: { name: customerName, avatar: customerAvatar },
                    partner: { id: b.providerId?._id?.toString() || 'N/A', name: partnerName, avatar: partnerAvatar },
                    category,
                    city: b.providerId?.city || '',
                    paymentMethod: method,
                    transactionType: 'Travel Charge',
                    amount: Math.round(b.travelCharge.amount * 100) / 100,
                    status: b.paymentStatus === 'paid' ? 'success' : 'pending',
                    date: dateStr,
                    rawDate: b.createdAt
                });
            }
        });

        // Add withdrawals as Partner Payouts
        currentWithdrawals.forEach(w => {
            const partnerName = w.providerId?.shopName || w.providerId?.ownerName || 'Partner';
            const partnerAvatar = w.providerId?.profileImage || '';

            const dateStr = new Date(w.createdAt).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            txns.push({
                id: `WDL-${w._id.toString().slice(-6).toUpperCase()}`,
                bookingId: 'N/A',
                customer: { name: 'N/A', avatar: '' },
                partner: { id: w.providerId?._id?.toString() || 'N/A', name: partnerName, avatar: partnerAvatar },
                category: 'Settlement',
                city: w.providerId?.city || '',
                paymentMethod: 'Bank Transfer',
                transactionType: 'Partner Payout',
                amount: Math.round(w.amount * 100) / 100,
                status: w.status === 'approved' ? 'success' : w.status === 'pending' ? 'processing' : 'failed',
                date: dateStr,
                rawDate: w.createdAt
            });
        });

        return txns.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
    }


    /* ================================================================== */
    /* Rendering from a rollup                                            */
    /* ================================================================== */

    /**
     * Everything below draws the dashboard from buckets rather than from a
     * list of bookings.
     *
     * The array-taking functions above now fold their rows into the same
     * buckets and call straight through to these, so there is one definition
     * of every figure and the in-memory path cannot drift from the database
     * one. EarningsRollupService fills the same buckets by aggregation, and
     * scripts/earningsRollupCheck.js holds the two against each other.
     */
    static _rollup() {
        // Required here rather than at the top: the rollup service needs this
        // one for the gross definition, so requiring it up there would be a
        // cycle.
        return require('./EarningsRollupService');
    }

    static overviewFromRollup(curr, prev, currentWithdrawals, prevWithdrawals, currentStart, currentEnd, interval) {
        const pct = (c, p) => (p === 0 ? 0 : Math.round(((c - p) / p) * 1000) / 10);
        const round = (v) => Math.round(v * 100) / 100;
        const pending = (list) => list.reduce((sum, w) => (w.status === 'pending' ? sum + w.amount : sum), 0);

        const card = (field, currValue, prevValue) => ({
            value: round(currValue),
            prevValue: round(prevValue),
            percentageChange: pct(currValue, prevValue),
            sparkline: this.binFromRollup(curr.byBin, currentStart, currentEnd, interval, field).map(p => p.value)
        });

        const pendingNow = pending(currentWithdrawals);
        return {
            grossSales: card('gross', curr.totals.gross, prev.totals.gross),
            // Commission earned, before the cost of the coin programme.
            companyRevenue: card('commission', curr.totals.commission, prev.totals.commission),
            // What RozSewa paid out in coin discounts over the period.
            coinSubsidy: card('coinSubsidy', curr.totals.coinSubsidy, prev.totals.coinSubsidy),
            // What RozSewa paid out in offer discounts over the period.
            offerSubsidy: card('offerSubsidy', curr.totals.offerSubsidy, prev.totals.offerSubsidy),
            // companyRevenue less every platform-funded discount — the figure
            // that actually lands.
            netRevenue: card('netRevenue', curr.totals.netRevenue, prev.totals.netRevenue),
            partnerPayout: card('payout', curr.totals.payout, prev.totals.payout),
            pendingSettlement: {
                value: round(pendingNow),
                prevValue: round(pending(prevWithdrawals)),
                percentageChange: pct(pendingNow, pending(prevWithdrawals)),
                sparkline: this.binData(currentWithdrawals, currentStart, currentEnd, interval,
                    w => (w.status === 'pending' ? w.amount : 0)).map(p => p.value)
            },
            travelCharges: card('travel', curr.totals.travel, prev.totals.travel),
            refunds: card('refunds', curr.totals.refunds, prev.totals.refunds)
        };
    }

    static revenueTrendFromRollup(curr, currentStart, currentEnd, interval) {
        return this.binFromRollup(curr.byBin, currentStart, currentEnd, interval, 'gross')
            .map(({ date, value }) => ({ date, revenue: value }));
    }

    static commissionTrendFromRollup(curr, currentStart, currentEnd, interval) {
        return this.binFromRollup(curr.byBin, currentStart, currentEnd, interval, 'commission')
            .map(({ date, value }) => ({ date, commission: value }));
    }

    static revenueSourcesFromRollup(curr) {
        const s = curr.sources;
        const total = s.service + s.visit + s.night + s.holiday + s.urgent + s.travel + s.other;
        const pc = (v) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
        const round = (v) => Math.round(v * 100) / 100;
        return [
            { name: 'Service Charges', amount: round(s.service), percentage: pc(s.service) },
            { name: 'Visit Charges', amount: round(s.visit), percentage: pc(s.visit) },
            { name: 'Night Charges', amount: round(s.night), percentage: pc(s.night) },
            { name: 'Holiday Charges', amount: round(s.holiday), percentage: pc(s.holiday) },
            { name: 'Urgent Booking Charges', amount: round(s.urgent), percentage: pc(s.urgent) },
            { name: 'Travel Charges', amount: round(s.travel), percentage: pc(s.travel) },
            { name: 'Other Charges', amount: round(s.other), percentage: pc(s.other) }
        ];
    }

    static categoryBreakdownFromRollup(curr) {
        const totalCommission = Object.values(curr.byCategory).reduce((sum, g) => sum + g.commission, 0);
        return Object.entries(curr.byCategory).map(([category, g]) => ({
            category,
            revenue: Math.round(g.revenue * 100) / 100,
            bookings: g.bookings,
            averageTicket: g.bookings > 0 ? Math.round((g.revenue / g.bookings) * 100) / 100 : 0,
            commission: Math.round(g.commission * 100) / 100,
            percent: totalCommission > 0 ? Math.round((g.commission / totalCommission) * 100) : 0
        })).sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category));
    }

    static travelAnalyticsFromRollup(curr, currentEnd) {
        const t = curr.travel;
        const round = (v) => Math.round(v * 100) / 100;

        const last7DaysStart = new Date(currentEnd);
        last7DaysStart.setDate(last7DaysStart.getDate() - 6);
        last7DaysStart.setHours(0, 0, 0, 0);

        return {
            totalTravelCharges: round(t.total),
            averageDistance: t.count > 0 ? Math.round((t.distance / t.count) * 10) / 10 : 0,
            averageTravelCharge: t.count > 0 ? round(t.total / t.count) : 0,
            highestCharge: round(t.highest),
            paidToPartners: round(t.total), // 100% goes to partner
            travelChargesToday: round(t.today),
            trend: this.binFromRollup(curr.travelByDay, last7DaysStart, currentEnd, 'day', 'value')
        };
    }

    static paymentAnalyticsFromRollup(curr) {
        return Object.entries(curr.byPayment).map(([name, d]) => ({
            name,
            value: Math.round(d.value * 100) / 100,
            count: d.count
        })).filter(item => item.count > 0);
    }

    static topPartnersFromRollup(curr) {
        return Object.values(curr.byPartner).map(p => ({
            name: p.name || 'Partner',
            avatar: p.avatar || '',
            revenue: Math.round(p.revenue * 100) / 100,
            bookings: p.bookings,
            rating: p.ratingCount > 0 ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : 4.5
        }))
            // Partners tie on revenue often enough to matter, and a tie with no
            // second key reorders itself between one request and the next — the
            // same screen refreshed showed a different top five. Name breaks it.
            .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
            .slice(0, 5);
    }

    /**
     * How many rows the ledger holds, by type, without building them.
     *
     * A booking contributes a Commission row (or a Refund row, if it was
     * cancelled or refunded) and a second Travel Charge row if it carried one;
     * a withdrawal contributes a Partner Payout. Counted in the database so the
     * figure under a table showing the newest fifty still describes the period.
     */
    static async ledgerRowCounts(Booking, match, instaRows, withdrawals) {
        const isRefund = {
            $or: [{ $eq: ['$paymentStatus', 'refunded'] }, { $eq: ['$status', 'cancelled'] }]
        };
        const hasLedgerRow = {
            $or: [
                { $gt: [{ $ifNull: ['$adminCommission', 0] }, 0] },
                { $gt: [{ $ifNull: ['$totalAmount', 0] }, 0] }
            ]
        };

        const [row] = await Booking.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    commission: { $sum: { $cond: [{ $and: [hasLedgerRow, { $not: isRefund }] }, 1, 0] } },
                    refund: { $sum: { $cond: [{ $and: [hasLedgerRow, isRefund] }, 1, 0] } },
                    travel: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$travelCharge.amount', 0] }, 0] }, 1, 0] } }
                }
            }
        ]);

        const counts = {
            commission: row?.commission || 0,
            refund: row?.refund || 0,
            'travel charge': row?.travel || 0,
            'partner payout': withdrawals.length
        };

        // Insta rows are already in hand, so they are counted the same way here.
        (instaRows || []).forEach(b => {
            const refund = b.paymentStatus === 'refunded' || b.status === 'cancelled';
            if (b.adminCommission > 0 || b.totalAmount > 0) counts[refund ? 'refund' : 'commission'] += 1;
            if (b.travelCharge?.amount > 0) counts['travel charge'] += 1;
        });

        counts.total = counts.commission + counts.refund + counts['travel charge'] + counts['partner payout'];
        return counts;
    }

    /**
     * The options the earnings filters offer, taken from the whole period.
     *
     * These used to be derived from the ledger rows, which was fine while every
     * row was loaded and became wrong the moment the ledger was cut down to the
     * ones on screen. The rollup already knows every category and every partner
     * with activity, so they come from there.
     */
    static async filterOptionsFromRollup(rollup, withdrawals, categories = []) {
        const Provider = require('../models/Provider');

        const partnerIds = Object.keys(rollup.byPartner);
        withdrawals.forEach(w => {
            const id = w.providerId?._id || w.providerId;
            if (id) partnerIds.push(String(id));
        });

        const docs = partnerIds.length
            ? await Provider.find({ _id: { $in: [...new Set(partnerIds)] } })
                .select('shopName ownerName city')
                .lean()
            : [];

        const partners = [];
        const cities = new Set();
        docs.forEach(p => {
            const name = p.shopName || p.ownerName;
            // The ledger skipped rows whose partner had no usable name.
            if (name && name !== 'Partner' && name !== 'N/A') {
                partners.push({ id: String(p._id), name });
            }
            if (p.city) cities.add(p.city);
        });

        const categorySet = new Set(Object.keys(rollup.byCategory));
        // A period of nothing but settlements has no categories in the ledger.
        if (categorySet.size === 0) categories.forEach(c => categorySet.add(c.category));

        // Sorted, which the old list was not: it came out in whatever order the
        // most recent transactions happened to mention things. The contents are
        // the same either way.
        return {
            categories: Array.from(categorySet).sort(),
            partners: partners.sort((a, b) => a.name.localeCompare(b.name)),
            cities: Array.from(cities).sort()
        };
    }

    static topCategoriesFromRollup(curr, prev) {
        return Object.entries(curr.byCategory).map(([category, c]) => {
            const p = prev.byCategory[category] || { revenue: 0, bookings: 0 };
            return {
                category,
                revenue: Math.round(c.revenue * 100) / 100,
                bookings: c.bookings,
                growth: p.revenue > 0 ? Math.round(((c.revenue - p.revenue) / p.revenue) * 1000) / 10 : 0
            };
        })
            .sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category))
            .slice(0, 5);
    }
}

module.exports = EarningsAnalyticsService;
