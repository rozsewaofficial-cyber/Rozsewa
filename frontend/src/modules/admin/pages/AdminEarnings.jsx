import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { IndianRupee, Download, TrendingUp, Calendar, CreditCard, Filter, Loader2, ArrowUpRight, ArrowDownRight, Wallet, ReceiptText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminEarnings = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [filterMonth, setFilterMonth] = useState(false);
    const [viewAll, setViewAll] = useState(false);
    const [stats, setStats] = useState({ grossSalesVolume: 0, netCommission: 0, pendingSettlements: 0 });
    const [breakdown, setBreakdown] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTitle("Revenue & Earnings");
        fetchData();
    }, [setTitle]);

    const fetchData = async () => {
        try {
            const { data } = await API.get('/admin/earnings');
            setStats(data.stats || { grossSalesVolume: 0, netCommission: 0, pendingSettlements: 0 });
            setBreakdown(data.breakdown || []);
            setTransactions(data.transactions || []);
            setLoading(false);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch earnings data", variant: "destructive" });
            setLoading(false);
        }
    };

    const displayTransactions = useMemo(() => {
        let filtered = transactions;
        if (filterMonth) {
            filtered = filtered.filter(t => t.isThisMonth);
        }
        return viewAll ? filtered : filtered.slice(0, 5);
    }, [transactions, filterMonth, viewAll]);

    const handleExport = () => {
        toast({ title: "Downloading Report", description: "Your revenue report is being generated..." });
        setTimeout(() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
            const downloadAnchorNode = document.createElement("a");
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "rozsewa_revenue.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            toast({ title: "Success", description: "Report downloaded successfully." });
        }, 1500);
    };

    const toggleMonthFilter = () => {
        setFilterMonth(!filterMonth);
        setViewAll(false);
        toast({
            title: !filterMonth ? "Filtered to This Month" : "Showing All Record",
            description: !filterMonth ? "Viewing recent transactions." : "Viewing historic transactions."
        });
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            {/* Header Options */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Platform Revenue</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Track commissions, total sales volume, and analyze financials.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={toggleMonthFilter}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${filterMonth ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            } shadow-sm active:scale-95`}
                    >
                        <Calendar className="h-3.5 w-3.5" /> {filterMonth ? "Current Month" : "All Time"}
                    </button>
                    <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95">
                        <Download className="h-3.5 w-3.5" /> Export Report
                    </button>
                </div>
            </div>

            {/* Revenue Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Gross Sales Volume", value: `₹${(stats.grossSalesVolume || 0).toLocaleString()}`, icon: ReceiptText, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Net Commission", value: `₹${(stats.netCommission || 0).toLocaleString()}`, icon: IndianRupee, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Pending Settlements", value: `₹${(stats.pendingSettlements || 0).toLocaleString()}`, icon: CreditCard, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Total Transactions", value: transactions.length, icon: Wallet, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                ].map((s, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${s.cls}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <s.icon className="h-3.5 w-3.5 opacity-70" />
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{s.label}</p>
                        </div>
                        <h3 className="text-2xl font-black">{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Breakdown & Table Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Breakdown List */}
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm h-full flex flex-col">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Commission Breakdown</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Revenue by category</p>
                    </div>
                    <div className="p-6 flex-1">
                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
                        ) : breakdown.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <TrendingUp className="h-10 w-10 text-gray-200 mb-3" />
                                <p className="text-sm font-bold text-gray-500">No data available</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {breakdown.map((item, idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-black text-gray-700 uppercase tracking-wider">{item.category}</span>
                                            <span className="text-sm font-black text-gray-900">₹{(item.amount || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.percent}%` }}
                                                transition={{ duration: 1, delay: idx * 0.1 }}
                                                className={`h-full rounded-full ${item.color || 'bg-blue-500'}`}
                                            />
                                        </div>
                                        <p className="text-right text-[9px] text-gray-400 font-black mt-1.5 uppercase tracking-widest">{item.percent}% Share</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">Recent Transactions</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Detailed payment history</p>
                        </div>
                        <button className="h-9 w-9 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">
                            <Filter className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                    <th className="py-4 px-5">Transaction ID</th>
                                    <th className="py-4 px-5">Type / Source</th>
                                    <th className="py-4 px-5 text-right">Amount</th>
                                    <th className="py-4 px-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan="4" className="py-20 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                                            <p className="text-sm text-gray-400 mt-3 font-medium">Loading transactions...</p>
                                        </td>
                                    </tr>
                                ) : displayTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="py-20 text-center">
                                            <ReceiptText className="h-10 w-10 text-gray-200 mx-auto" />
                                            <p className="text-sm text-gray-400 mt-3 font-bold">No transactions found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    <AnimatePresence>
                                        {displayTransactions.map((t, idx) => (
                                            <motion.tr
                                                key={t.id || idx}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="hover:bg-gray-50/80 transition-colors group"
                                            >
                                                <td className="py-3.5 px-5">
                                                    <p className="font-mono font-bold text-gray-900 text-xs">{t.id}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{t.date}</p>
                                                </td>
                                                <td className="py-3.5 px-5">
                                                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-600 border border-gray-200">
                                                        {t.type}
                                                    </span>
                                                    <p className="text-xs font-bold text-gray-800 mt-1.5 truncate max-w-[150px]">{t.provider}</p>
                                                </td>
                                                <td className="py-3.5 px-5 text-right">
                                                    <p className={`font-black text-sm flex items-center justify-end gap-0.5 ${t.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {t.amount > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                        <IndianRupee className="h-3.5 w-3.5" />
                                                        {Math.abs(t.amount).toLocaleString()}
                                                    </p>
                                                    <p className="text-[9px] text-gray-400 font-black mt-1 uppercase tracking-widest">{t.method}</p>
                                                </td>
                                                <td className="py-3.5 px-5 text-center">
                                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        t.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                        t.status === 'pending_settlement' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                        'bg-gray-50 text-gray-700 border border-gray-200'
                                                    }`}>
                                                        {(t.status || '').replace('_', ' ')}
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-gray-100 text-center bg-gray-50">
                        {!viewAll && transactions.length > 5 ? (
                            <button onClick={() => setViewAll(true)} className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest transition-colors">
                                View All Transactions
                            </button>
                        ) : (
                            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">End of Record</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminEarnings;
