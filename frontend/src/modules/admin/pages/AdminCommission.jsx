import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Landmark, ArrowRightLeft, CalendarCheck, TrendingUp, Users, IndianRupee, Percent, CreditCard } from "lucide-react";
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
    const [stats, setStats] = useState({ platformRevenue: 0, totalJobValue: 0, totalProviderPayout: 0, totalCompleted: 0, pendingPayouts: 0, processedToday: 0, disputedHold: 0 });
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTitle("Commission & Settlements");
        fetchData();
    }, [setTitle]);

    const fetchData = async () => {
        try {
            const { data } = await API.get('/admin/commission');
            setStats(data.stats);
            setQueue(data.queue);
            setLoading(false);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch commission data", variant: "destructive" });
            setLoading(false);
        }
    };

    const avgRate = stats.totalJobValue > 0 ? ((stats.platformRevenue / stats.totalJobValue) * 100).toFixed(1) : '0';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Commission & Settlements</h1>
                    <p className="text-sm text-muted-foreground mt-1">Track platform commission from every completed booking.</p>
                </div>
                <button onClick={fetchData} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700 transition active:scale-95">
                    Refresh Data
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
                    { title: "Pending Payouts", value: `₹${stats.pendingPayouts.toLocaleString()}`, icon: <Landmark className="h-4 w-4" />, color: "text-amber-700 bg-amber-50 border-amber-200" },
                ].map((s, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${s.color}`}>
                        <div className="flex items-center gap-1.5 mb-2 opacity-80">{s.icon}<p className="text-[10px] font-bold uppercase tracking-wider">{s.title}</p></div>
                        <h3 className="text-xl font-black">{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Commission Table */}
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
                        {/* Totals Footer */}
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
        </div>
    );
};

export default AdminCommission;
