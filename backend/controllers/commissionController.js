const Booking = require('../models/Booking');
const Withdrawal = require('../models/Withdrawal');
const { Wallet } = require('../models/Wallet');
const Setting = require('../models/Setting');

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
        const completedBookings = await Booking.find({ status: 'completed' });

        // Gross Sales Volume
        const grossSalesVolume = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);

        // Net Platform Commission
        const netCommission = completedBookings.reduce((sum, b) => sum + (b.adminCommission || 0), 0);

        // Pending Settlements (Sum of pending withdrawals)
        const pendingWithdrawals = await Withdrawal.find({ status: 'pending' });
        const pendingSettlements = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

        // Commission Breakdown by Service
        const breakdown = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: '$serviceName', amount: { $sum: '$adminCommission' } } },
            { $sort: { amount: -1 } },
            { $limit: 4 }
        ]);

        const totalCom = breakdown.reduce((sum, item) => sum + item.amount, 0);
        const formattedBreakdown = breakdown.map((item, index) => ({
            category: item._id,
            amount: item.amount,
            percent: totalCom > 0 ? Math.round((item.amount / totalCom) * 100) : 0,
            color: ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'][index] || 'bg-gray-500'
        }));

        // Recent Transactions (Recent completed bookings)
        const recentBookings = await Booking.find({ status: 'completed' })
            .populate('providerId', 'shopName')
            .sort({ createdAt: -1 })
            .limit(10);

        const transactions = recentBookings.map(b => ({
            id: `TXN-${b._id.toString().slice(-6).toUpperCase()}`,
            type: "Commission",
            provider: b.providerId?.shopName || 'N/A',
            amount: b.adminCommission,
            date: new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
            method: b.paymentMode === 'after' ? 'Cash' : 'Online Payment',
            status: b.paymentStatus === 'paid' ? 'success' : 'pending_settlement',
            isThisMonth: new Date(b.createdAt).getMonth() === new Date().getMonth()
        }));

        res.json({
            stats: {
                grossSalesVolume,
                netCommission,
                pendingSettlements
            },
            breakdown: formattedBreakdown,
            transactions
        });
    } catch (error) {
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
