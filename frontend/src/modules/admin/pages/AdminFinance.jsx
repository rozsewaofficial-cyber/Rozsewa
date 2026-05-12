import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Wallet, Landmark, FileText, Download, TrendingUp, Search, CheckCircle } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AdminFinance = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [stats, setStats] = useState({ escrowBalance: 0, gstPayable: 0, platformProfit: 0, cashManaged: 0 });
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setTitle("Finance & GST");
    fetchData();
  }, [setTitle]);

  const fetchData = async () => {
    try {
      const { data } = await API.get('/admin/finance');
      setStats(data.stats);
      setLedger(data.ledger);
      setLoading(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch finance data", variant: "destructive" });
      setLoading(false);
    }
  };

  const formatAmount = (amount) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const filteredLedger = ledger.filter(item => 
    item.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Finance & GST Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Cash reconciliation, GST reporting, and platform wallet oversight.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Escrow Balance", val: formatAmount(stats.escrowBalance), icon: Wallet, color: "text-blue-600 bg-blue-50" },
          { title: "GST Payable", val: formatAmount(stats.gstPayable), icon: FileText, color: "text-rose-600 bg-rose-50" },
          { title: "Platform Profit", val: formatAmount(stats.platformProfit), icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
          { title: "Cash Managed", val: formatAmount(stats.cashManaged), icon: Landmark, color: "text-amber-600 bg-amber-50" }
        ].map((card, i) => (
          <div key={i} className="p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all">
            <div className={`h-12 w-12 rounded-2xl ${card.color} flex items-center justify-center mb-4`}>
              <card.icon className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none mb-2">{card.title}</p>
            <h3 className="text-2xl font-black text-gray-900">{card.val}</h3>
            <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-tight">T+1 Data Cycle</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-sm uppercase tracking-wider text-gray-900">Cash Reconciliation Ledger</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Vendor or Bill ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium" 
              />
            </div>
          </div>
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
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No COD transactions found.</td>
                  </tr>
                ) : filteredLedger.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{item.id}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Physical Collection</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700">{item.vendor}</td>
                    <td className="px-6 py-4 font-black text-amber-600">₹{item.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold text-red-600">₹{item.cut.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider block w-fit ${item.status === 'Settled' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 shadow-sm border border-amber-100 cursor-pointer hover:bg-amber-100 transition'}`}>
                        {item.status === 'Settled' ? <CheckCircle className="h-3 w-3 inline mr-1" /> : ""} {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
