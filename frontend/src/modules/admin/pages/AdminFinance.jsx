import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  Wallet, Landmark, FileText, Download, TrendingUp, Search, 
  CheckCircle, Calendar, Edit3, Check, X, Loader2, Filter, 
  ArrowUpRight, FileSpreadsheet, AlertCircle 
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from "recharts";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const AdminFinance = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  
  // Stats & Ledger state
  const [stats, setStats] = useState({ escrowBalance: 0, gstPayable: 0, platformProfit: 0, cashManaged: 0, gstRate: 18 });
  const [ledger, setLedger] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Search state
  const [range, setRange] = useState("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // GST Inline Edit state
  const [gstEditMode, setGstEditMode] = useState(false);
  const [newGstRate, setNewGstRate] = useState("");
  const [isUpdatingGst, setIsUpdatingGst] = useState(false);

  // Settle loading state
  const [settlingId, setSettlingId] = useState("");

  useEffect(() => {
    setTitle("Finance & GST");
  }, [setTitle]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = { range };
      if (range === "custom") {
        if (!startDate || !endDate) return; // Wait for both dates
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const { data } = await API.get('/admin/finance', { params });
      setStats(data.stats);
      setLedger(data.ledger);
      setTimeline(data.timeline || []);
      setNewGstRate(data.stats.gstRate.toString());
      setLoading(false);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error.response?.data?.message || "Failed to fetch finance data", 
        variant: "destructive" 
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range, startDate, endDate]);

  const handleUpdateGstRate = async (e) => {
    e.preventDefault();
    const rateVal = parseFloat(newGstRate);
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter a valid GST rate between 0% and 100%.", 
        variant: "destructive" 
      });
      return;
    }
    try {
      setIsUpdatingGst(true);
      await API.post('/admin/finance/gst-rate', { rate: rateVal });
      toast({ title: "Success", description: `GST rate updated to ${rateVal}%` });
      setGstEditMode(false);
      fetchData();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error.response?.data?.message || "Failed to update GST rate", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdatingGst(false);
    }
  };

  const handleSettleBooking = async (id) => {
    try {
      setSettlingId(id);
      await API.post(`/admin/finance/settle/${id}`);
      toast({ title: "Success", description: "Transaction settled successfully and provider's wallet updated." });
      fetchData();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error.response?.data?.message || "Failed to settle transaction", 
        variant: "destructive" 
      });
    } finally {
      setSettlingId("");
    }
  };

  const handleExportCSV = () => {
    if (filteredLedger.length === 0) {
      toast({ title: "No Data", description: "No ledger transactions found to export." });
      return;
    }
    const headers = ["Transaction ID", "Vendor", "Cash Due (₹)", "Platform Cut (₹)", "Status", "Date"];
    const rows = filteredLedger.map(item => [
      item.id,
      item.vendor,
      item.amount,
      item.cut,
      item.status,
      new Date(item.date).toLocaleDateString('en-IN')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST_Finance_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Success", description: "Ledger data exported successfully." });
  };

  const formatAmount = (amount) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)}L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatYAxis = (tickItem) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(0)}k`;
    return `₹${tickItem}`;
  };

  const filteredLedger = ledger.filter(item => {
    const matchesSearch = item.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-2xl border border-gray-100 bg-white/95 backdrop-blur-md p-4 shadow-xl text-left">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
            {payload[0].payload.date}
          </p>
          {payload.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-6 justify-between mt-1.5">
              <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-sm font-black text-gray-900">
                ₹{entry.value.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Title & GST Configuration Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Finance & GST Center</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Cash reconciliation, GST reporting, and platform wallet oversight.</p>
        </div>

        {/* Dynamic GST Settings Widget */}
        <div className="flex items-center gap-3 bg-white border border-gray-200/80 rounded-2xl p-3 shadow-sm max-w-sm">
          <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current GST Rate</p>
            {gstEditMode ? (
              <form onSubmit={handleUpdateGstRate} className="flex items-center gap-2 mt-1">
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="100"
                  value={newGstRate} 
                  onChange={e => setNewGstRate(e.target.value)}
                  className="w-16 px-2 py-0.5 border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  required
                />
                <span className="text-xs font-bold text-gray-600">%</span>
                <button 
                  type="submit" 
                  disabled={isUpdatingGst}
                  className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-50"
                  title="Save"
                >
                  {isUpdatingGst ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setGstEditMode(false); setNewGstRate(stats.gstRate.toString()); }}
                  className="p-1 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 transition"
                  title="Cancel"
                >
                  <X className="h-3 w-3" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-gray-900">{stats.gstRate}%</span>
                <button 
                  onClick={() => setGstEditMode(true)}
                  className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Edit GST Rate"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel: Date Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <span className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mr-2 shrink-0">
            <Filter className="h-3.5 w-3.5" /> Period:
          </span>
          {[
            { label: "Today", value: "today" },
            { label: "Last 7 Days", value: "7d" },
            { label: "Last 30 Days", value: "30d" },
            { label: "Last 90 Days", value: "90d" },
            { label: "Custom Range", value: "custom" }
          ].map(btn => (
            <button
              key={btn.value}
              onClick={() => setRange(btn.value)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 ${
                range === btn.value
                  ? "bg-gray-900 text-white shadow-md shadow-gray-900/10"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {range === "custom" && (
          <div className="flex items-center gap-2.5 w-full md:w-auto animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="relative w-full md:w-40">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-white font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <span className="text-xs font-black text-gray-400">to</span>
            <div className="relative w-full md:w-40">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-white font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { 
            title: "Escrow Balance", 
            val: formatAmount(stats.escrowBalance), 
            icon: Wallet, 
            color: "text-blue-600 bg-blue-50/50 border-blue-100/50", 
            desc: "Active Provider Wallet Funds",
            glow: "shadow-blue-500/5"
          },
          { 
            title: "GST Payable", 
            val: formatAmount(stats.gstPayable), 
            icon: FileText, 
            color: "text-rose-600 bg-rose-50/50 border-rose-100/50", 
            desc: `Accrued Tax @ ${stats.gstRate}%`,
            glow: "shadow-rose-500/5"
          },
          { 
            title: "Platform Profit", 
            val: formatAmount(stats.platformProfit), 
            icon: TrendingUp, 
            color: "text-emerald-600 bg-emerald-50/50 border-emerald-100/50", 
            desc: "Net Platform Earnings",
            glow: "shadow-emerald-500/5"
          },
          { 
            title: "Cash Managed", 
            val: formatAmount(stats.cashManaged), 
            icon: Landmark, 
            color: "text-amber-600 bg-amber-50/50 border-amber-100/50", 
            desc: "Total CoD Volume Managed",
            glow: "shadow-amber-500/5"
          }
        ].map((card, i) => (
          <div key={i} className={`p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden group ${card.glow}`}>
            {/* Background Glow */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 blur-xl group-hover:scale-150 transition-transform duration-500 bg-current text-gray-400" />
            
            <div className="flex justify-between items-start mb-4">
              <div className={`h-12 w-12 rounded-2xl ${card.color} border flex items-center justify-center shrink-0`}>
                <card.icon className="h-5 w-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.5">
                Live
              </span>
            </div>
            
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{card.title}</p>
            <h3 className="text-3xl font-black text-gray-900 tracking-tight leading-none">
              {loading ? <Skeleton className="h-8 w-24" /> : card.val}
            </h3>
            <p className="text-[10px] font-semibold text-gray-400 mt-2.5">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Interactive Trend Chart */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col h-[400px]">
        <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-6">
          <div>
            <h3 className="text-base font-black text-gray-900 tracking-tight">Finance Trend Analysis</h3>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">Visualization of Net Platform Profit versus tax collected.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Profit
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> GST
            </span>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="h-full flex flex-col justify-end gap-3 pb-2">
              <Skeleton className="h-[75%] w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ) : timeline.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 mb-3">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">No Performance Data</h4>
              <p className="mt-1 max-w-[240px] text-[10px] font-semibold text-gray-400 leading-normal">
                No completed orders or revenue available in the selected period.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="gstGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#9ca3af" }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 10, fontWeight: 700, fill: "#9ca3af" }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }} />
                <Area 
                  type="monotone" 
                  name="Platform Profit" 
                  dataKey="platformProfit" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#profitGrad)" 
                />
                <Area 
                  type="monotone" 
                  name="GST Payable" 
                  dataKey="gstPayable" 
                  stroke="#f43f5e" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#gstGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ledger Container */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Ledger Header & Search/Filter Controls */}
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-gray-900">Cash Reconciliation Ledger</h3>
            <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">Collect platform cut and settle cash balances with vendors.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Vendor or Bill ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-all font-bold text-gray-700" 
              />
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold text-gray-600 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 cursor-pointer"
            >
              <option value="all">All Settlements</option>
              <option value="due">Due Only</option>
              <option value="settled">Settled Only</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-xl transition-all shadow-sm"
              title="Export Ledger report to CSV"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/80 text-[10px] uppercase font-black tracking-widest text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Transaction Details</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Cash Due</th>
                <th className="px-6 py-4">Platform Cut</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-300" />
                    Loading Ledger Records...
                  </td>
                </tr>
              ) : filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold">
                    No COD transactions found matching the parameters.
                  </td>
                </tr>
              ) : filteredLedger.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50/30 transition group">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{item.id}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 flex items-center gap-1">
                      Physical Collection • {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-700">{item.vendor}</td>
                  <td className="px-6 py-4 font-black text-amber-600">₹{item.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 font-bold text-rose-600">₹{item.cut.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4">
                    {item.status === 'Settled' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <CheckCircle className="h-3 w-3 shrink-0" /> Settled
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to settle the COD booking ${item.id} for ${item.vendor}?`)) {
                            handleSettleBooking(item._id);
                          }
                        }}
                        disabled={settlingId === item._id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200 shadow-sm hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all duration-200"
                      >
                        {settlingId === item._id ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-0.5" /> Settling</>
                        ) : (
                          <><ArrowUpRight className="h-3 w-3 mr-0.5" /> Settle Now</>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
