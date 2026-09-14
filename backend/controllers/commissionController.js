const Booking = require('../models/Booking');
const Withdrawal = require('../models/Withdrawal');
const { Wallet } = require('../models/Wallet');
const Setting = require('../models/Setting');
const EarningsAnalyticsService = require('../services/EarningsAnalyticsService');
const CashSettlementService = require('../services/CashSettlementService');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const ProviderBanner = require('../models/ProviderBanner');
const InstaEarningsAdapter = require('../services/InstaEarningsAdapter');
const Provider = require('../models/Provider');
const { pageParams, paginate } = require('../utils/pagination');
const SettlementQueue = require('../services/SettlementQueueService');

// @desc    Get commission and settlement data
// @route   GET /api/admin/commission
// @access  Private (Admin)
const getCommissionData = async (req, res) => {
    try {
        // Totals come from the database, and only one page of rows is loaded.
        // This used to pull every completed booking and every completed Insta
        // job into memory — populated — to produce four numbers and one
        // screenful, which does not survive a real dataset.
        const { page, limit } = req.query;
        const [totals, formattedQueue] = await Promise.all([
            SettlementQueue.getTotals(),
            SettlementQueue.getPage({ page, limit })
        ]);
        const { platformRevenue, totalJobValue, totalProviderPayout } = totals;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Two figures, so two sums. These used to pull every pending withdrawal
        // and every one approved today into memory to add up their amounts.
        const [withdrawalSums] = await Withdrawal.aggregate([
            {
                $match: {
                    $or: [
                        { status: 'pending' },
                        { status: 'approved', updatedAt: { $gte: startOfToday } }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
                    processedToday: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } }
                }
            }
        ]);
        const pendingPayouts = withdrawalSums?.pending || 0;
        const processedToday = withdrawalSums?.processedToday || 0;

        // Settlements: one row per provider who owes money or has ever settled
        // some. This used to load every provider wallet, populated, and every
        // settlement transaction ever recorded, then narrow both in JavaScript.
        // Now the database narrows it and hands back one page plus the totals,
        // so the row under the table describes all of it and not just the page.
        const settlementRows = [
            { $match: { providerId: { $exists: true, $ne: null } } },
            {
                $lookup: {
                    from: 'transactions',
                    let: { pid: '$providerId' },
                    pipeline: [
                        {
                            $match: {
                                title: 'Debt Settlement',
                                status: 'completed',
                                $expr: { $eq: ['$providerId', '$$pid'] }
                            }
                        },
                        { $group: { _id: null, amount: { $sum: '$amount' } } }
                    ],
                    as: 'settled'
                }
            },
            {
                $addFields: {
                    totalSettled: { $ifNull: [{ $arrayElemAt: ['$settled.amount', 0] }, 0] },
                    currentDues: { $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0] }
                }
            },
            { $match: { $or: [{ currentDues: { $gt: 0 } }, { totalSettled: { $gt: 0 } }] } }
        ];

        const settlementLimit = Math.min(200, Math.max(1, Number(limit) || 10));
        const settlementPage = Math.max(1, Number(req.query.settlementPage) || 1);

        const [settlementFacet] = await Wallet.aggregate([
            ...settlementRows,
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                count: { $sum: 1 },
                                inDebt: { $sum: { $cond: [{ $gt: ['$currentDues', 0] }, 1, 0] } },
                                currentDues: { $sum: '$currentDues' },
                                totalSettled: { $sum: '$totalSettled' }
                            }
                        }
                    ],
                    page: [
                        { $sort: { currentDues: -1, _id: 1 } },
                        { $skip: (settlementPage - 1) * settlementLimit },
                        { $limit: settlementLimit },
                        // Only the rows being shown need their provider.
                        {
                            $lookup: {
                                from: 'providers',
                                localField: 'providerId',
                                foreignField: '_id',
                                as: 'provider'
                            }
                        },
                        { $unwind: '$provider' },
                        {
                            $project: {
                                _id: 0,
                                providerId: '$provider._id',
                                shopName: '$provider.shopName',
                                ownerName: '$provider.ownerName',
                                vendorCode: '$provider.vendorCode',
                                currentDues: 1,
                                totalSettled: 1,
                                walletBalance: '$balance'
                            }
                        }
                    ]
                }
            }
        ]);

        // The screen keys rows by _id, as it did when these were wallets.
        const settlements = (settlementFacet?.page || []).map(r => ({ ...r, _id: r.providerId }));
        const settlementTotals = settlementFacet?.totals?.[0] || { count: 0, currentDues: 0, totalSettled: 0 };

        res.json({
            stats: {
                platformRevenue: Math.round(platformRevenue * 100) / 100,
                totalJobValue: Math.round(totalJobValue * 100) / 100,
                totalProviderPayout: Math.round(totalProviderPayout * 100) / 100,
                totalCompleted: totals.totalCompleted,
                pendingPayouts: Math.round(pendingPayouts * 100) / 100,
                processedToday: Math.round(processedToday * 100) / 100,
                disputedHold: 0
            },
            queue: formattedQueue,
            // The table pages server-side now, so it needs to be told how many
            // rows exist and what the whole queue adds up to — its totals row
            // describes the queue, not the page being looked at.
            queuePage: Math.max(1, Number(page) || 1),
            queueLimit: formattedQueue.length,
            queueTotal: totals.totalCompleted,
            queueTotals: {
                jobV: Math.round(totalJobValue * 100) / 100,
                com: Math.round(platformRevenue * 100) / 100,
                pay: Math.round(totalProviderPayout * 100) / 100
            },
            settlements,
            settlementsPage: settlementPage,
            settlementsTotal: settlementTotals.count,
            settlementsTotals: {
                inDebtCount: settlementTotals.inDebt || 0,
                currentDues: Math.round(settlementTotals.currentDues * 100) / 100,
                totalSettled: Math.round(settlementTotals.totalSettled * 100) / 100
            }
        });
    } catch (error) {
        console.error('getCommissionData error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get finance and GST data
// @route   GET /api/admin/finance
// @access  Private (Admin)
const getFinanceData = async (req, res) => {
    try {
        const { range, startDate, endDate } = req.query;
        const { currentStart, currentEnd, interval } = EarningsAnalyticsService.getPeriodDates(range, startDate, endDate);

        // Escrow Balance (Sum of all wallet balances - point-in-time). One
        // number, so it is added up in the database rather than by loading
        // every wallet on the platform to add them up here.
        const [escrow] = await Wallet.aggregate([
            { $group: { _id: null, balance: { $sum: '$balance' } } }
        ]);
        const escrowBalance = escrow?.balance || 0;

        // The chart bins these by date, so the rows are still needed — but only
        // two fields of each, and without hydrating them into documents.
        const completedBookings = await Booking.find({
            status: 'completed',
            createdAt: { $gte: currentStart, $lte: currentEnd }
        })
            .select('adminCommission createdAt')
            .lean();
        const platformRevenue = completedBookings.reduce((sum, b) => sum + (b.adminCommission || 0), 0);

        // Dynamic GST rate from settings
        const gstRateSetting = await Setting.findOne({ key: 'gstRate' });
        const gstRate = gstRateSetting ? Number(gstRateSetting.value) : 18;

        const gstPayable = platformRevenue * (gstRate / 100);
        const platformProfit = platformRevenue - gstPayable;

        // Cash Managed (COD bookings in date range). The headline figure covers
        // every one of them; the ledger below it is a page.
        const codScope = {
            status: 'completed',
            paymentMode: 'after',
            createdAt: { $gte: currentStart, $lte: currentEnd }
        };
        const [codTotals] = await Booking.aggregate([
            { $match: codScope },
            { $group: { _id: null, cash: { $sum: '$totalAmount' } } }
        ]);
        const cashManaged = codTotals?.cash || 0;

        // Ledger. The screen searches by vendor name and filters by whether the
        // cash has been collected, so both happen here — searching in the browser
        // could only ever find what had already been sent, which is one page.
        const ledgerScope = { ...codScope };
        const wanted = String(req.query.status || "").toLowerCase();
        if (wanted === 'settled') ledgerScope.paymentStatus = 'paid';
        else if (wanted === 'due') ledgerScope.paymentStatus = { $ne: 'paid' };

        const term = String(req.query.search || "").trim();
        if (term) {
            // Escaped both times: what was typed is a name to look for, not a
            // pattern to run.
            const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const rx = new RegExp(escape(term), "i");
            // A ledger id is the tail of the booking id, so a search for one is a
            // search for bookings whose id ends that way.
            const bare = escape(term.replace(/^COD-/i, ""));
            const shops = await Provider.find({ shopName: rx }).select("_id").lean();
            ledgerScope.$or = [
                { providerId: { $in: shops.map(p => p._id) } },
                { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: bare, options: "i" } } }
            ];
        }

        const ledgerParams = pageParams(req);
        const [ledgerTotal, codBookings] = await Promise.all([
            Booking.countDocuments(ledgerScope),
            paginate(
                Booking.find(ledgerScope)
                    .populate('providerId', 'shopName')
                    .sort({ createdAt: -1 }),
                ledgerParams
            )
        ]);

        const ledger = codBookings.map(b => ({
            _id: b._id,
            id: `COD-${b._id.toString().slice(-6).toUpperCase()}`,
            vendor: b.providerId?.shopName || 'N/A',
            amount: b.totalAmount,
            cut: b.adminCommission,
            status: b.paymentStatus === 'paid' ? 'Settled' : 'Due',
            date: b.createdAt
        }));

        // Binned timeline data for charts
        const binnedRevenue = EarningsAnalyticsService.binData(
            completedBookings,
            currentStart,
            currentEnd,
            interval,
            b => b.adminCommission || 0
        );

        const timeline = binnedRevenue.map(bin => {
            const rev = bin.value;
            const gst = rev * (gstRate / 100);
            const profit = rev - gst;
            return {
                date: bin.key,
                platformRevenue: Math.round(rev * 100) / 100,
                gstPayable: Math.round(gst * 100) / 100,
                platformProfit: Math.round(profit * 100) / 100
            };
        });

        res.json({
            stats: {
                escrowBalance: Math.round(escrowBalance * 100) / 100,
                gstPayable: Math.round(gstPayable * 100) / 100,
                platformProfit: Math.round(platformProfit * 100) / 100,
                cashManaged: Math.round(cashManaged * 100) / 100,
                gstRate
            },
            ledger,
            // What matched, so the table can page through it and the export can
            // cover it rather than stopping at the rows on screen.
            ledgerTotal,
            timeline
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Settle a Cash on Delivery booking payment
// @route   POST /api/admin/finance/settle/:id
// @access  Private (Admin)
const settleCodBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        // Same collectability rules as the partner and staff routes, so an
        // admin settlement can't slip past a check the others enforce.
        const blocked = CashSettlementService.checkCollectable(booking);
        if (blocked) {
            return res.status(blocked.status).json({ message: blocked.message });
        }

        // Records the collection and writes the payment audit row. It moves no
        // money on purpose: the partner is holding the customer's cash and the
        // payout was settled against their dues wallet at completion. This
        // route used to credit the full payout on top, paying them twice.
        await CashSettlementService.recordCollection(booking, {
            collectedBy: 'admin',
            actorId: req.user._id,
            actorRole: req.user.role || 'admin',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
            deviceInfo: req.headers['user-agent'] || null,
            note: 'Cash on delivery settled by admin from the Finance screen.'
        });

        await booking.save();

        // Add Audit Log
        await AuditLog.create({
            actionType: 'FINANCE_COD_SETTLEMENT',
            entityType: 'BOOKING',
            entityId: booking._id,
            entityName: `COD Settle: ${booking.serviceName}`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || "Admin",
            verifiedByRole: req.user.role || "admin",
            details: {
                bookingId: booking._id,
                totalAmount: booking.totalAmount,
                adminCommission: booking.adminCommission,
                providerPayout: booking.providerPayout
            }
        });

        res.json({ success: true, message: 'Transaction settled successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update GST rate configuration
// @route   POST /api/admin/finance/gst-rate
// @access  Private (Admin)
const updateGstRate = async (req, res) => {
    try {
        const { rate } = req.body;
        const numRate = Number(rate);
        if (isNaN(numRate) || numRate < 0 || numRate > 100) {
            return res.status(400).json({ message: 'GST rate must be a valid number between 0% and 100%' });
        }

        const prevSetting = await Setting.findOne({ key: 'gstRate' });
        const oldValue = prevSetting ? prevSetting.value : null;

        await Setting.findOneAndUpdate(
            { key: 'gstRate' },
            { value: numRate, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        // Add Audit Log
        await AuditLog.create({
            actionType: 'FINANCE_GST_RATE_UPDATE',
            entityType: 'GST_SETTING',
            entityId: new mongoose.Types.ObjectId(),
            entityName: `GST Rate updated`,
            verifiedBy: req.user._id,
            verifiedByName: req.user.name || "Admin",
            verifiedByRole: req.user.role || "admin",
            details: {
                oldValue,
                newValue: numRate
            }
        });

        res.json({ success: true, message: `GST rate updated to ${numRate}%` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Exactly the fields the earnings analytics read.
 *
 * The dashboard used to load whole hydrated documents with the provider and
 * the customer fully populated: at 20,000 bookings that was 371 MB and six
 * seconds for a page of charts. Lean rows carrying only these fields are the
 * same numbers for a twenty-sixth of the memory.
 */
const EARNINGS_FIELDS = 'totalAmount adminCommission providerPayout coinDiscount offerSubsidy'
    + ' commissionSnapshot travelCharge paymentMode paymentStatus status createdAt'
    + ' serviceName extraCharges rating providerId userId';
const EARNINGS_PROVIDER_FIELDS = 'shopName ownerName profileImage city';
const EARNINGS_CUSTOMER_FIELDS = 'name profileImage';
/** How many ledger rows the table ever shows at once. */
const LEDGER_ROWS = 500;
// @desc    Get earnings and revenue data
// @route   GET /api/admin/earnings
// @access  Private (Admin)
const getEarningsData = async (req, res) => {
    try {
        const { range, startDate, endDate, category, partnerId, city, paymentMethod, bookingStatus, transactionType } = req.query;

        const { currentStart, currentEnd, prevStart, prevEnd, interval } = EarningsAnalyticsService.getPeriodDates(range, startDate, endDate);

        // Build query for current period bookings
        const currentMatch = {
            createdAt: { $gte: currentStart, $lte: currentEnd }
        };

        if (bookingStatus) {
            currentMatch.status = bookingStatus;
        } else {
            // Default to completed, but allow cancelled for refunds analytics
            currentMatch.status = { $in: ['completed', 'cancelled'] };
        }

        if (category) {
            currentMatch.$or = [
                { 'commissionSnapshot.bookingCategorySnapshot.name': category },
                { 'serviceName': category }
            ];
        }

        let targetProviderId = null;
        if (partnerId) {
            if (mongoose.Types.ObjectId.isValid(partnerId)) {
                targetProviderId = partnerId;
            } else {
                const Provider = require('../models/Provider');
                const matchedProvider = await Provider.findOne({
                    $or: [
                        { ownerName: new RegExp(`^${partnerId}$`, 'i') },
                        { shopName: new RegExp(`^${partnerId}$`, 'i') }
                    ]
                });
                if (matchedProvider) {
                    targetProviderId = matchedProvider._id;
                } else {
                    targetProviderId = new mongoose.Types.ObjectId();
                }
            }
        }

        if (targetProviderId) {
            currentMatch.providerId = targetProviderId;
        }

        let currentBookings = await Booking.find(currentMatch)
            .select(EARNINGS_FIELDS)
            .populate('providerId', EARNINGS_PROVIDER_FIELDS)
            .populate('userId', EARNINGS_CUSTOMER_FIELDS)
            .lean();

        // Insta Work jobs are reported alongside bookings. They are appended
        // after the Booking query rather than merged into it because the two
        // live in different collections with different status vocabularies;
        // the adapter translates one into the other. Appended here, before the
        // city and payment-method filters, so those apply to Insta rows too.
        currentBookings = currentBookings.concat(await InstaEarningsAdapter.getJobsForEarnings({
            start: currentStart,
            end: currentEnd,
            providerId: targetProviderId,
            status: currentMatch.status,
            category
        }));

        // In-memory filter for city (since providerId is populated)
        if (city) {
            currentBookings = currentBookings.filter(b => b.providerId && b.providerId.city && b.providerId.city.toLowerCase() === city.toLowerCase());
        }

        // Filter by how the customer paid.
        //
        // This used to offer UPI, Card, Wallet and Net Banking, deciding which
        // was which by hashing the booking id — so filtering to "Card" returned
        // an arbitrary slice of prepaid bookings that had nothing to do with
        // cards. The instrument is not recorded anywhere, so the filter now
        // offers the distinction that exists. The old labels are still accepted
        // and treated as prepaid, rather than a saved dashboard returning
        // nothing.
        if (paymentMethod) {
            const wantsCash = /^cash/i.test(paymentMethod);
            currentBookings = currentBookings.filter(b =>
                wantsCash ? b.paymentMode === 'after' : b.paymentMode !== 'after');
        }

        // Fetch bookings for previous period (matching same criteria)
        const prevMatch = {
            createdAt: { $gte: prevStart, $lte: prevEnd },
            status: currentMatch.status
        };

        if (currentMatch.$or) {
            prevMatch.$or = currentMatch.$or;
        }
        if (currentMatch.providerId) {
            prevMatch.providerId = currentMatch.providerId;
        }

        let prevBookings = await Booking.find(prevMatch)
            .select(EARNINGS_FIELDS)
            .populate('providerId', EARNINGS_PROVIDER_FIELDS)
            .lean();
        prevBookings = prevBookings.concat(await InstaEarningsAdapter.getJobsForEarnings({
            start: prevStart,
            end: prevEnd,
            providerId: targetProviderId,
            status: currentMatch.status,
            category
        }));

        if (city) {
            prevBookings = prevBookings.filter(b => b.providerId && b.providerId.city && b.providerId.city.toLowerCase() === city.toLowerCase());
        }

        // Fetch withdrawals (settlements)
        const withdrawalMatch = {
            createdAt: { $gte: currentStart, $lte: currentEnd }
        };
        if (targetProviderId) {
            withdrawalMatch.providerId = targetProviderId;
        }
        let currentWithdrawals = await Withdrawal.find(withdrawalMatch).populate('providerId');

        const prevWithdrawalMatch = {
            createdAt: { $gte: prevStart, $lte: prevEnd }
        };
        if (targetProviderId) {
            prevWithdrawalMatch.providerId = targetProviderId;
        }
        let prevWithdrawals = await Withdrawal.find(prevWithdrawalMatch);

        // Fetch Banner Promotions Revenue
        const currentBanners = await ProviderBanner.find({
            createdAt: { $gte: currentStart, $lte: currentEnd },
            paymentId: { $ne: null }
        });
        // pricePaid stores the base price, so we multiply by 1.18 to get exact Total Payload collected
        const bannerRevenue = Math.round(currentBanners.reduce((sum, b) => sum + (b.pricePaid || 0) * 1.18, 0));

        const hasHistoricalData = currentBookings.length > 0 || currentWithdrawals.length > 0 || currentBanners.length > 0;

        if (!hasHistoricalData) {
            return res.json({
                hasHistoricalData: false,
                overview: {
                    grossSales: { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] },
                    companyRevenue: { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] },
                    partnerPayout: { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] },
                    pendingSettlement: { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] },
                    travelCharges: { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] },
                    refunds: { value: 0, prevValue: 0, percentageChange: 0, sparkline: [] }
                },
                trends: { '7d': [], '30d': [], '90d': [], 'year': [] },
                categories: [],
                revenueSources: [],
                travel: {
                    totalTravelCharges: 0,
                    averageDistance: 0,
                    averageTravelCharge: 0,
                    highestCharge: 0,
                    paidToPartners: 0,
                    travelChargesToday: 0,
                    trend: []
                },
                settlements: {
                    paidToday: 0,
                    pending: 0,
                    processing: 0,
                    failed: 0,
                    avgSettlementTime: "N/A",
                    pendingPartnersCount: 0
                },
                payments: [],
                partners: {
                    topPartners: [],
                    topCategories: []
                },
                transactions: [],
                promotions: {
                    bannerRevenue: 0,
                    totalBanners: 0
                }
            });
        }

        // Compute analytics using service layer
        const overview = EarningsAnalyticsService.getOverviewStats(
            currentBookings,
            prevBookings,
            currentWithdrawals,
            prevWithdrawals,
            currentStart,
            currentEnd,
            prevStart,
            prevEnd,
            interval
        );

        const trends = {
            '7d': range === '7d' ? EarningsAnalyticsService.getRevenueTrend(currentBookings, currentStart, currentEnd, 'day') : [],
            '30d': range === '30d' || !range ? EarningsAnalyticsService.getRevenueTrend(currentBookings, currentStart, currentEnd, 'day') : [],
            '90d': range === '90d' ? EarningsAnalyticsService.getRevenueTrend(currentBookings, currentStart, currentEnd, 'day') : [],
            'year': (range === 'year' || range === '12m') ? EarningsAnalyticsService.getRevenueTrend(currentBookings, currentStart, currentEnd, 'month') : []
        };

        // Load trends on demand if not matching current selection to save overhead, or pre-populate current selection
        const activeTrendLabel = (range === 'year' || range === '12m') ? 'year' : (range || '30d');
        const activeTrendRevenue = trends[activeTrendLabel];
        const activeTrendCommission = (range === 'year' || range === '12m')
            ? EarningsAnalyticsService.getCommissionTrend(currentBookings, currentStart, currentEnd, 'month')
            : EarningsAnalyticsService.getCommissionTrend(currentBookings, currentStart, currentEnd, 'day');

        const categories = EarningsAnalyticsService.getCategoryBreakdown(currentBookings);
        const revenueSources = EarningsAnalyticsService.getRevenueSources(currentBookings);
        const travel = EarningsAnalyticsService.getTravelAnalytics(currentBookings, currentStart, currentEnd);
        const settlements = EarningsAnalyticsService.getSettlementAnalytics(currentWithdrawals);
        const payments = EarningsAnalyticsService.getPaymentAnalytics(currentBookings);
        const topPartners = EarningsAnalyticsService.getTopPartners(currentBookings);
        const topCategories = EarningsAnalyticsService.getTopCategories(currentBookings, prevBookings);
        let transactions = EarningsAnalyticsService.getRecentTransactions(currentBookings, currentWithdrawals);

        // Filter transactions list if transactionType is specified
        if (transactionType) {
            transactions = transactions.filter(t => t.transactionType.toLowerCase() === transactionType.toLowerCase());
        }

        // The ledger carries a row or two per booking, so a wide range used to
        // put tens of thousands of them in one response. The table only ever
        // shows the most recent, but the screen also builds its filter
        // dropdowns from this list — so the options are sent separately,
        // derived from the whole set, and only the visible rows are shipped.
        const transactionsTotal = transactions.length;
        const filterOptions = EarningsAnalyticsService.getFilterOptions(transactions, categories);
        transactions = transactions.slice(0, LEDGER_ROWS);

        res.json({
            hasHistoricalData: true,
            overview,
            trends: {
                ...trends,
                activeTrendRevenue,
                activeTrendCommission
            },
            categories,
            revenueSources,
            travel,
            settlements,
            payments,
            partners: {
                topPartners,
                topCategories
            },
            transactions,
            transactionsTotal,
            filterOptions,
            promotions: {
                bannerRevenue,
                totalBanners: currentBanners.length
            }
        });
    } catch (error) {
        console.error('getEarningsData error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get sewak incentives data
// @route   GET /api/admin/sewak-incentives
// @access  Private (Admin)
const getIncentives = async (req, res) => {
    try {
        const { date } = req.query; // Expects YYYY-MM-DD
        const targetDate = date || new Date().toISOString().split('T')[0];

        // Fetch config from settings
        const configSetting = await Setting.findOne({ key: 'sewak_incentive_config' });
        const config = configSetting ? configSetting.value : { threshold: 5, bonusAmount: 50 };

        const bookings = await Booking.find({ 
            status: 'completed',
            bookingDate: targetDate
        }).populate('providerId', 'ownerName shopName');

        // Group by provider
        const providerMap = {};
        bookings.forEach(b => {
            if (b.providerId) {
                const pid = b.providerId._id.toString();
                if (!providerMap[pid]) {
                    providerMap[pid] = {
                        _id: pid,
                        sewakId: b.providerId,
                        dailyBookingCount: 0,
                        bonusEarned: 0
                    };
                }
                providerMap[pid].dailyBookingCount += 1;
            }
        });

        // Calculate bonus
        const logs = Object.values(providerMap).map(log => {
            const extra = log.dailyBookingCount - config.threshold;
            if (extra > 0) {
                log.bonusEarned = extra * config.bonusAmount;
            }
            return log;
        });

        res.json({
            logs,
            config
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update sewak incentive settings
// @route   POST /api/admin/sewak-incentive-settings
// @access  Private (Admin)
const updateIncentiveSettings = async (req, res) => {
    try {
        const { threshold, bonusAmount } = req.body;
        
        let setting = await Setting.findOne({ key: 'sewak_incentive_config' });
        if (setting) {
            setting.value = { threshold: Number(threshold), bonusAmount: Number(bonusAmount) };
            setting.updatedAt = Date.now();
            await setting.save();
        } else {
            setting = await Setting.create({
                key: 'sewak_incentive_config',
                value: { threshold: Number(threshold), bonusAmount: Number(bonusAmount) }
            });
        }

        res.json({ message: "Settings updated successfully", config: setting.value });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCommissionData,
    getFinanceData,
    getEarningsData,
    getIncentives,
    updateIncentiveSettings,
    settleCodBooking,
    updateGstRate
};
