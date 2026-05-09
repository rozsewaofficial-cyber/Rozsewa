import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Wallet, Landmark, FileText, Download, TrendingUp, Search, CheckCircle } from "lucide-react";

const AdminFinance = () => {
  const { setTitle } = useOutletContext();

  useEffect(() => {
    setTitle("Finance & GST");
  }, [setTitle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Finance & GST Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Cash reconciliation, GST reporting, and platform wallet oversight.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Escrow Balance", val: "₹14.2L", icon: Wallet, color: "text-blue-600 bg-blue-50" },
          { title: "GST Payable", val: "₹1.4L", icon: FileText, color: "text-rose-600 bg-rose-50" },
          { title: "Platform Profit", val: "₹2.8L", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
          { title: "Cash Managed", val: "₹0.9L", icon: Landmark, color: "text-amber-600 bg-amber-50" }
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-sm uppercase tracking-wider text-gray-900">Cash Reconciliation Ledger</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Vendor or Bill ID..." className="pl-9 pr-3 py-2 w-full text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium" />
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
                {[
                  { id: "COD-001", vendor: "Royal Salon", amount: "₹4,200", cut: "₹420", status: "Due" },
                  { id: "COD-002", vendor: "Apex Delivery", amount: "₹150", cut: "₹15", status: "Settled" }
                ].map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{item.id}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Physical Collection</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700">{item.vendor}</td>
                    <td className="px-6 py-4 font-black text-amber-600">{item.amount}</td>
                    <td className="px-6 py-4 font-bold text-red-600">{item.cut}</td>
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

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col h-full">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">GST Filings Hub</h3>
          <div className="space-y-4 flex-1">
            {[
              { month: "February 2026", status: "Filing Ready", tax: "₹42,890", icon: FileText, sub: "GSTR-1, GSTR-3B" },
              { month: "January 2026", status: "Completed", tax: "₹38,102", icon: CheckCircle, sub: "Receipt #440192" }
            ].map((filing, i) => (
              <div key={i} className="p-4 rounded-xl border border-gray-100 group hover:border-emerald-300 transition-colors shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="h-10 w-10 shrink-0 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                      <filing.icon className="h-5 w-5 text-gray-500 group-hover:text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">{filing.month}</h4>
                      <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{filing.sub}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${filing.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{filing.status}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm font-black text-gray-900">{filing.tax}</p>
                  <button className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600 hover:scale-105 transition"><Download className="h-3.5 w-3.5" /> CSV Report</button>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full py-3.5 bg-gray-900 text-white rounded-2xl font-black text-xs hover:bg-black transition shadow-lg active:scale-95 transition-all">Download FY 25-26 Summary</button>
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
