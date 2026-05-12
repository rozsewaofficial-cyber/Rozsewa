import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { IndianRupee, Download, TrendingUp, Calendar, CreditCard, Filter } from "lucide-react";
import { motion } from "framer-motion";
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
      setStats(data.stats);
      setBreakdown(data.breakdown);
      setTransactions(data.transactions);
      setLoading(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch earnings data", variant: "destructive" });
      setLoading(false);
    }
  };

  useEffect(() => {
    setTitle("Revenue & Earnings");
  }, [setTitle]);

  const displayTransactions = transactions
    .filter(t => !filterMonth || t.isThisMonth)
    .slice(0, viewAll ? undefined : 4);

  const handleExport = () => {
    toast({ title: "Downloading Report", description: "Your revenue report is being generated..." });
    setTimeout(() => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(initialTransactions, null, 2));
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
    toast({ 
      title: !filterMonth ? "Filtered to This Month" : "Showing All Record", 
      description: !filterMonth ? "Viewing transactions from March 2026." : "Viewing all historic transactions." 
    });
  };

  const handleViewAll = () => {
    setViewAll(true);
    toast({ title: "Viewing All Transactions", description: "The full list is now visible." });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header Options */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Platform Revenue</h2>
          <p className="mt-1 text-sm text-gray-500">Track commissions, total sales volume, and analyze financials.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={toggleMonthFilter}
             className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${filterMonth ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' } shadow-sm`}
           >
             <Calendar className="h-4 w-4" /> {filterMonth ? "March 2026" : "This Month"}
           </button>
           <button onClick={handleExport} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors">
             <Download className="h-4 w-4" /> Export Report
           </button>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <IndianRupee className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><TrendingUp className="h-3 w-3" /> +14.2%</span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold text-gray-500">Gross Sales Volume</p>
            <h3 className="mt-1 text-3xl font-black text-gray-900 tracking-tight">₹{stats.grossSalesVolume.toLocaleString()}</h3>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 shadow-md shadow-emerald-600/20">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">+8.5%</span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold text-emerald-800">Net Platform Commission</p>
            <h3 className="mt-1 text-3xl font-black text-emerald-900 tracking-tight">₹{stats.netCommission.toLocaleString()}</h3>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
              <CreditCard className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold text-gray-500">Pending Settlements</p>
            <h3 className="mt-1 text-3xl font-black text-gray-900 tracking-tight">₹{stats.pendingSettlements.toLocaleString()}</h3>
          </div>
        </motion.div>
      </div>

      {/* Breakdown & Table Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* Breakdown List */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm h-fit">
           <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Commission Breakdown</h3>
           <div className="space-y-5">
             {breakdown.length === 0 ? (
               <p className="text-sm text-gray-500">No data available</p>
             ) : breakdown.map(item => (
               <div key={item.category}>
                 <div className="flex justify-between items-center text-sm font-bold text-gray-700 mb-2">
                   <span>{item.category}</span>
                   <span className="text-sm font-extrabold text-gray-900">₹{item.amount.toLocaleString()}</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percent}%` }}
                    className={`h-2 rounded-full ${item.color}`} 
                   />
                 </div>
                 <p className="text-right text-[10px] text-gray-500 font-bold mt-1">{item.percent}% share</p>
               </div>
             ))}
           </div>
        </div>

        {/* Transactions Table */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
            <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Filter className="h-5 w-5" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="py-4 px-6 font-bold">Transaction ID</th>
                  <th className="py-4 px-6 font-bold">Type</th>
                  <th className="py-4 px-6 font-bold">Amount</th>
                  <th className="py-4 px-6 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="py-4 px-6 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : displayTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-4 px-6 text-center text-gray-500">No transactions found.</td>
                  </tr>
                ) : displayTransactions.map((t) => (
                  <motion.tr key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50/50 transition-colors">
                     <td className="py-4 px-6">
                       <p className="font-mono font-bold text-gray-900">{t.id}</p>
                       <p className="text-xs text-gray-500 font-medium mt-0.5">{t.date}</p>
                     </td>
                     <td className="py-4 px-6">
                       <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700 border border-gray-200">
                         {t.type}
                       </span>
                       <p className="text-xs font-semibold text-gray-600 mt-1">from {t.provider}</p>
                     </td>
                     <td className="py-4 px-6">
                       <p className={`font-extrabold text-${t.amount > 0 ? 'emerald' : 'red'}-600 flex items-center gap-0.5`}>
                         {t.amount > 0 ? '+' : '-'}<IndianRupee className="h-3.5 w-3.5" />{Math.abs(t.amount)}
                       </p>
                       <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{t.method}</p>
                     </td>
                     <td className="py-4 px-6">
                       <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                         t.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                         t.status === 'pending_settlement' ? 'bg-amber-100 text-amber-700' : 
                         'bg-gray-100 text-gray-700'
                       }`}>
                         {t.status.replace('_', ' ')}
                       </span>
                     </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-gray-100 text-center bg-gray-50 mt-auto">
            {!viewAll ? (
              <button onClick={handleViewAll} className="text-sm font-bold text-emerald-600 hover:text-emerald-700">View All Transactions</button>
            ) : (
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">End of Record</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEarnings;
