import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { Landmark, ArrowRightLeft, CalendarCheck, TrendingUp, IndianRupee, Percent, CreditCard, AlertTriangle, CheckCircle, Clock, XCircle, ShieldAlert, ArrowDownToLine, RefreshCw } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const STATUS_LABELS = {
    free: 'Free Trial',
    free_new_joiner: 'New Joiner (Free)',
    subscription_basic: 'Basic Plan',
    subscription_pro: 'Pro Plan',
    subscription_elite: 'Elite Plan',
    slab_commission: 'Slab Rate',
    sewak_revenue: 'Sewak (100%)',
    commissioned: 'Commissioned',
};

const STATUS_COLORS = {
    free: 'bg-gray-100 text-gray-600',
    free_new_joiner: 'bg-blue-100 text-blue-700',
    subscription_basic: 'bg-indigo-100 text-indigo-700',
    subscription_pro: 'bg-purple-100 text-purple-700',
    subscription_elite: 'bg-amber-100 text-amber-700',
    slab_commission: 'bg-teal-100 text-teal-700',
    sewak_revenue: 'bg-rose-100 text-rose-700',
    commissioned: 'bg-emerald-100 text-emerald-700',
};

const AdminCommission = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('commission');
    const [stats, setStats] = useState({ platformRevenue: 0, totalJobValue: 0, totalProviderPayout: 0, totalCompleted: 0, pendingPayouts: 0, processedToday: 0, disputedHold: 0 });
    const [queue, setQueue] = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [processing, setProcessing] = useState({});
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    useScrollLock(!!rejectModal);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTitle("Commission & Settlements");
        fetchData();
        fetchWithdrawals();
    }, [setTitle]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/admin/commission');
            setStats(data.stats);
            setQueue(data.queue);
            setSettlements(data.settlements || []);
            setLoading(false);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch commission data", variant: "destructive" });
            setLoading(false);
        }
    };

    const fetchWithdrawals = async () => {
        try {
            const { data } = await API.get('/admin/withdrawals');
            setWithdrawals(data);
        } catch (error) {
            console.error('Failed to fetch withdrawals', error);
        }
    };

    const handleWithdrawalAction = async (id, status, reason) => {
        setProcessing(prev => ({ ...prev, [id]: true }));
        try {
            await API.patch(`/admin/withdrawals/${id}`, { status, reason });
            toast({ title: `Withdrawal ${status}`, description: `Request has been ${status} successfully.` });
            fetchWithdrawals();
            setRejectModal(null);
            setRejectReason('');
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.message || "Failed to update", variant: "destructive" });
        } finally {
            setProcessing(prev => ({ ...prev, [id]: false }));
        }
    };

    const avgRate = stats.totalJobValue > 0 ? ((stats.platformRevenue / stats.totalJobValue) * 100).toFixed(1) : '0';

    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
    const inDebtProviders = settlements.filter(s => s.currentDues > 0);

    const TABS = [
        { id: 'commission', label: 'Commission Breakdown', icon: <ArrowRightLeft className="h-4 w-4" /> },
        { id: 'cash_limit', label: 'Cash Limit', icon: <ShieldAlert className="h-4 w-4" />, badge: inDebtProviders.length },
        { id: 'withdrawal', label: 'Withdrawal Requests', icon: <ArrowDownToLine className="h-4 w-4" />, badge: pendingWithdrawals.length },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Commission & Settlements</h1>
                    <p className="text-sm text-muted-foreground mt-1">Track platform commission, cash debts, and payout requests.</p>
                </div>
                <button 
                    onClick={async () => { 
                        await Promise.all([fetchData(), fetchWithdrawals()]);
                        toast({ title: "Refreshed", description: "Data has been updated." });
                    }} 
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { title: "Platform Revenue", value: `₹${stats.platformRevenue.toLocaleString()}`, icon: <IndianRupee className="h-4 w-4" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { title: "Gross Job Value", value: `₹${stats.totalJobValue.toLocaleString()}`, icon: <TrendingUp className="h-4 w-4" />, color: "text-blue-700 bg-blue-50 border-blue-200" },
                    { title: "Provider Payouts", value: `₹${stats.totalProviderPayout.toLocaleString()}`, icon: <CreditCard className="h-4 w-4" />, color: "text-violet-700 bg-violet-50 border-violet-200" },
                    { title: "Avg Commission", value: `${avgRate}%`, icon: <Percent className="h-4 w-4" />, color: "text-orange-700 bg-orange-50 border-orange-200" },
                    { title: "Total Completed", value: stats.totalCompleted, icon: <CalendarCheck className="h-4 w-4" />, color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
                    { title: "Pending Withdrawals", value: `${pendingWithdrawals.length}`, icon: <Landmark className="h-4 w-4" />, color: "text-amber-700 bg-amber-50 border-amber-200" },
                ].map((s, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${s.color}`}>
                        <div className="flex items-center gap-1.5 mb-2 opacity-80">{s.icon}<p className="text-[10px] font-bold uppercase tracking-wider">{s.title}</p></div>
                        <h3 className="text-xl font-black">{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.badge > 0 && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-600'}`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* === TAB: COMMISSION BREAKDOWN === */}
            {activeTab === 'commission' && (
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-emerald-600"/> Booking-wise Commission Breakdown</h3>
                        <span className="text-xs font-bold text-gray-400 uppercase">{queue.length} Records</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-bold">Booking</th>
                                    <th className="px-4 py-3 font-bold">Vendor</th>
                                    <th className="px-4 py-3 font-bold">Service</th>
                                    <th className="px-4 py-3 font-bold">Date</th>
                                    <th className="px-4 py-3 font-bold text-right">Job Value</th>
                                    <th className="px-4 py-3 font-bold text-right">Commission</th>
                                    <th className="px-4 py-3 font-bold text-right">Rate</th>
                                    <th className="px-4 py-3 font-bold text-right">Payout</th>
                                    <th className="px-4 py-3 font-bold text-center">Type</th>
                                    <th className="px-4 py-3 font-bold text-center">Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                                            <div className="flex items-center justify-center gap-2"><div className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div> Loading...</div>
                                        </td>
                                    </tr>
                                ) : queue.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" className="px-4 py-8 text-center text-gray-400">No completed bookings found.</td>
                                    </tr>
                                ) : queue.map((row) => (
                                    <tr key={row._id} className="hover:bg-gray-50/80 transition group">
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-mono font-black text-gray-800">#{row.bookingId}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{row.vendor}</p>
                                                {row.vendorOwner && <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{row.vendorOwner}</p>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-medium text-gray-700 truncate max-w-[160px]">{row.serviceName}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-[11px] text-gray-600">{row.bookingDate}</p>
                                            <p className="text-[10px] text-gray-400">{row.bookingTime}</p>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs font-bold text-gray-800">₹{row.jobV?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs font-black ${row.com > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {row.com > 0 ? `-₹${row.com.toLocaleString()}` : '₹0'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs font-bold ${parseFloat(row.comRate) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                                {row.comRate}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-xs font-black text-emerald-700">₹{row.pay?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${STATUS_COLORS[row.commissionStatus] || 'bg-gray-100 text-gray-600'}`}>
                                                {STATUS_LABELS[row.commissionStatus] || row.commissionStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${row.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {row.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {!loading && queue.length > 0 && (
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr>
                                        <td colSpan="4" className="px-4 py-3 text-xs font-black text-gray-700 uppercase">Totals ({queue.length} bookings)</td>
                                        <td className="px-4 py-3 text-right text-xs font-black text-gray-800">
                                            ₹{queue.reduce((s, r) => s + (r.jobV || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs font-black text-red-600">
                                            -₹{queue.reduce((s, r) => s + (r.com || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs font-bold text-orange-600">
                                            {avgRate}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs font-black text-emerald-700">
                                            ₹{queue.reduce((s, r) => s + (r.pay || 0), 0).toLocaleString()}
                                        </td>
                                        <td colSpan="2"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* === TAB: CASH LIMIT === */}
            {activeTab === 'cash_limit' && (
                <div className="space-y-4">
                    {inDebtProviders.length > 0 && (
                        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3">
                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                            <p className="text-sm font-bold text-rose-800">
                                {inDebtProviders.length} provider{inDebtProviders.length > 1 ? 's are' : ' is'} currently in debt — total dues: ₹{inDebtProviders.reduce((s, r) => s + r.currentDues, 0).toLocaleString()}
                            </p>
                        </div>
                    )}
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-600"/> Provider Debt & Cash Limit Ledger</h3>
                            <span className="text-xs font-bold text-gray-400 uppercase">{settlements.length} Records</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Provider</th>
                                        <th className="px-4 py-3 font-bold">Vendor Code</th>
                                        <th className="px-4 py-3 font-bold text-right">Current Balance</th>
                                        <th className="px-4 py-3 font-bold text-right">Pending Dues</th>
                                        <th className="px-4 py-3 font-bold text-right">Total Settled</th>
                                        <th className="px-4 py-3 font-bold text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                                                <div className="flex items-center justify-center gap-2"><div className="h-4 w-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div> Loading...</div>
                                            </td>
                                        </tr>
                                    ) : settlements.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-12 text-center">
                                                <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
                                                <p className="text-gray-400 font-medium">All providers are in good standing!</p>
                                            </td>
                                        </tr>
                                    ) : settlements.map((row) => (
                                        <tr key={row._id} className={`hover:bg-gray-50/80 transition group ${row.currentDues > 0 ? 'bg-rose-50/30' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{row.shopName}</p>
                                                    <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{row.ownerName}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-mono font-black text-gray-800">{row.vendorCode}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-bold ${row.walletBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    ₹{row.walletBalance.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-black ${row.currentDues > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                    {row.currentDues > 0 ? `₹${row.currentDues.toLocaleString()}` : '₹0'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-xs font-black text-emerald-700">₹{(row.totalSettled || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${row.currentDues > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {row.currentDues > 0 ? <AlertTriangle className="h-2.5 w-2.5" /> : <CheckCircle className="h-2.5 w-2.5" />}
                                                    {row.currentDues > 0 ? 'In Debt' : 'Cleared'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {!loading && settlements.length > 0 && (
                                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                        <tr>
                                            <td colSpan="3" className="px-4 py-3 text-xs font-black text-gray-700 uppercase">Platform Totals</td>
                                            <td className="px-4 py-3 text-right text-xs font-black text-red-600">
                                                ₹{settlements.reduce((s, r) => s + (r.currentDues || 0), 0).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs font-black text-emerald-700">
                                                ₹{settlements.reduce((s, r) => s + (r.totalSettled || 0), 0).toLocaleString()}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* === TAB: WITHDRAWAL REQUESTS === */}
            {activeTab === 'withdrawal' && (
                <div className="space-y-4">
                    {pendingWithdrawals.length > 0 && (
                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3">
                            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-sm font-bold text-amber-800">
                                {pendingWithdrawals.length} pending request{pendingWithdrawals.length > 1 ? 's' : ''} — total: ₹{pendingWithdrawals.reduce((s, w) => s + w.amount, 0).toLocaleString()}
                            </p>
                        </div>
                    )}
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2"><ArrowDownToLine className="h-4 w-4 text-violet-600"/> Withdrawal Requests</h3>
                            <span className="text-xs font-bold text-gray-400 uppercase">{withdrawals.length} Total</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Request ID</th>
                                        <th className="px-4 py-3 font-bold">Provider</th>
                                        <th className="px-4 py-3 font-bold">Bank Details</th>
                                        <th className="px-4 py-3 font-bold">Date</th>
                                        <th className="px-4 py-3 font-bold text-right">Amount</th>
                                        <th className="px-4 py-3 font-bold text-center">Status</th>
                                        <th className="px-4 py-3 font-bold text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {withdrawals.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-12 text-center">
                                                <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
                                                <p className="text-gray-400 font-medium">No withdrawal requests found.</p>
                                            </td>
                                        </tr>
                                    ) : withdrawals.map((w) => (
                                        <tr key={w._id} className="hover:bg-gray-50/80 transition">
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-mono font-black text-gray-800">#{w._id.toString().slice(-6).toUpperCase()}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{w.providerId?.shopName || 'N/A'}</p>
                                                    <p className="text-[10px] text-gray-400">{w.providerId?.mobile}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-700">{w.bankDetails?.bankName || '—'}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">****{w.bankDetails?.accountNumber?.slice(-4)}</p>
                                                    <p className="text-[10px] text-gray-400">{w.bankDetails?.ifscCode}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-[11px] text-gray-600">{new Date(w.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                <p className="text-[10px] text-gray-400">{new Date(w.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-black text-gray-900">₹{w.amount.toLocaleString()}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                                    w.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                    w.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {w.status === 'approved' && <CheckCircle className="h-2.5 w-2.5" />}
                                                    {w.status === 'rejected' && <XCircle className="h-2.5 w-2.5" />}
                                                    {w.status === 'pending' && <Clock className="h-2.5 w-2.5" />}
                                                    {w.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {w.status === 'pending' ? (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => handleWithdrawalAction(w._id, 'approved')}
                                                            disabled={processing[w._id]}
                                                            className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                                                        >
                                                            {processing[w._id] ? '...' : 'Approve'}
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectModal(w._id)}
                                                            disabled={processing[w._id]}
                                                            className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black hover:bg-rose-200 transition active:scale-95 disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 italic">{w.reason || 'Done'}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-black text-gray-900 mb-2">Reject Withdrawal</h3>
                        <p className="text-sm text-gray-500 mb-4">Provide a reason. The amount will be refunded to the provider's wallet.</p>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 outline-none focus:border-rose-400 mb-4"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                            <button
                                onClick={() => handleWithdrawalAction(rejectModal, 'rejected', rejectReason)}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 transition"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCommission;
