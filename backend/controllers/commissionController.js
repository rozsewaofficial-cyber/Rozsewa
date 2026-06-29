const Booking = require('../models/Booking');
const Withdrawal = require('../models/Withdrawal');
const { Wallet } = require('../models/Wallet');
const Setting = require('../models/Setting');
const EarningsAnalyticsService = require('../services/EarningsAnalyticsService');
const mongoose = require('mongoose');

// @desc    Get commission and settlement data
// @route   GET /api/admin/commission
// @access  Private (Admin)
const getCommissionData = async (req, res) => {
    try {
        const { Transaction } = require('../models/Wallet');
        // Stats
        const completedBookings = await Booking.find({ status: 'completed' });
        
        const platformRevenue = completedBookings.reduce((sum, b) => sum + (b.adminCommission || 0), 0);
        const totalJobValue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const totalProviderPayout = completedBookings.reduce((sum, b) => {
            // For legacy bookings where providerPayout was never set, use totalAmount - adminCommission
            const payout = b.providerPayout > 0 ? b.providerPayout : (b.totalAmount - (b.adminCommission || 0));
            return sum + payout;
        }, 0);
        
        const pendingWithdrawals = await Withdrawal.find({ status: 'pending' });
        const pendingPayouts = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
        
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const processedTodayDocs = await Withdrawal.find({ status: 'approved', updatedAt: { $gte: startOfToday } });
        const processedToday = processedTodayDocs.reduce((sum, w) => sum + w.amount, 0);

        // Queue (Recent completed bookings with actual data)
        const queue = await Booking.find({ status: 'completed' })
            .populate('providerId', 'shopName ownerName bankDetails planType providerCategory')
            .sort({ createdAt: -1 })
            .limit(20);

        const formattedQueue = queue.map(b => {
            const commission = b.adminCommission || 0;
            // For legacy bookings, payout = totalAmount - commission
            const payout = b.providerPayout > 0 ? b.providerPayout : (b.totalAmount - commission);
            const commissionRate = b.totalAmount > 0 ? ((commission / b.totalAmount) * 100).toFixed(1) : '0';
            
            return {
                _id: b._id,
                bookingId: b._id.toString().slice(-6).toUpperCase(),
                vendor: b.providerId?.shopName || 'N/A',
                vendorOwner: b.providerId?.ownerName || '',
                vendorPlan: b.providerId?.planType || 'none',
                vendorCategory: b.providerId?.providerCategory || 'provider',
                serviceName: b.serviceName,
                bookingDate: b.bookingDate,
                bookingTime: b.bookingTime,
                jobV: b.totalAmount,
                com: commission,
                comRate: commissionRate,
                pay: payout,
                commissionStatus: b.commissionStatus || 'free',
                paymentMode: b.paymentMode || 'now',
                paymentStatus: b.paymentStatus,
                status: b.paymentStatus === 'paid' ? 'Processed' : 'Ready to Pay',
                createdAt: b.createdAt
            };
        });

        // Settlements Logic
        const wallets = await Wallet.find({ providerId: { $exists: true } }).populate('providerId', 'shopName ownerName vendorCode');
        const transactions = await Transaction.find({ title: 'Debt Settlement', status: 'completed' });

        const settlements = wallets.map(w => {
           if (!w.providerId) return null;
           const providerTxns = transactions.filter(t => t.providerId && t.providerId.toString() === w.providerId._id.toString());
           const totalSettled = providerTxns.reduce((sum, t) => sum + t.amount, 0);
           
           if (w.balance < 0 || totalSettled > 0) {
              return {
                 _id: w.providerId._id,
                 shopName: w.providerId.shopName,
                 ownerName: w.providerId.ownerName,
                 vendorCode: w.providerId.vendorCode,
                 currentDues: w.balance < 0 ? Math.abs(w.balance) : 0,
                 totalSettled: totalSettled,
                 walletBalance: w.balance
              }
           }
           return null;
        }).filter(Boolean);

        res.json({
            stats: {
                platformRevenue: Math.round(platformRevenue * 100) / 100,
                totalJobValue: Math.round(totalJobValue * 100) / 100,
                totalProviderPayout: Math.round(totalProviderPayout * 100) / 100,
                totalCompleted: completedBookings.length,
                pendingPayouts: Math.round(pendingPayouts * 100) / 100,
                processedToday: Math.round(processedToday * 100) / 100,
                disputedHold: 0
            },
            queue: formattedQueue,
            settlements
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
        // Escrow Balance (Sum of all wallet balances)
        const wallets = await Wallet.find();
        const escrowBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

        // Platform Revenue (Sum of adminCommission from completed bookings)
        const completedBookings = await Booking.find({ status: 'completed' });
        const platformRevenue = completedBookings.reduce((sum, b) => sum + (b.adminCommission || 0), 0);

        // GST Payable (Assume 18% of platform revenue)
        const gstPayable = platformRevenue * 0.18;

        // Platform Profit
        const platformProfit = platformRevenue - gstPayable;

        // Cash Managed (Sum of totalAmount for completed bookings with paymentMode 'after')
        const codBookings = await Booking.find({ status: 'completed', paymentMode: 'after' })
            .populate('providerId', 'shopName');
        const cashManaged = codBookings.reduce((sum, b) => sum + b.totalAmount, 0);

        // Ledger (COD Bookings)
        const ledger = codBookings.map(b => ({
            _id: b._id,
            id: `COD-${b._id.toString().slice(-6).toUpperCase()}`,
            vendor: b.providerId?.shopName || 'N/A',
            amount: b.totalAmount,
            cut: b.adminCommission,
            status: b.paymentStatus === 'paid' ? 'Settled' : 'Due'
        }));

        res.json({
            stats: {
                escrowBalance,
                gstPayable,
                platformProfit,
                cashManaged
            },
            ledger
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

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
            .populate('providerId')
            .populate('userId');

        // In-memory filter for city (since providerId is populated)
        if (city) {
            currentBookings = currentBookings.filter(b => b.providerId && b.providerId.city && b.providerId.city.toLowerCase() === city.toLowerCase());
        }

        // In-memory filter for payment method
        if (paymentMethod) {
            currentBookings = currentBookings.filter(b => {
                if (b.paymentMode === 'after') {
                    return paymentMethod === 'Cash';
                } else {
                    const hashNum = b._id.toString().split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 100;
                    let method = 'UPI';
                    if (hashNum < 55) method = 'UPI';
                    else if (hashNum < 75) method = 'Card';
                    else if (hashNum < 90) method = 'Wallet';
                    else method = 'Net Banking';
                    return paymentMethod === method;
                }
            });
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

        let prevBookings = await Booking.find(prevMatch).populate('providerId');

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

        const hasHistoricalData = currentBookings.length > 0 || currentWithdrawals.length > 0;

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
                transactions: []
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
            transactions
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
    updateIncentiveSettings
};
