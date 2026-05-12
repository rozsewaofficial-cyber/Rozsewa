import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Landmark, CheckCircle, XCircle, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminWithdrawals = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setTitle("Withdrawal Requests");
    fetchWithdrawals();
  }, [setTitle]);

  const fetchWithdrawals = async () => {
    try {
      const { data } = await API.get('/admin/withdrawals');
      setWithdrawals(data);
      setLoading(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch withdrawals", variant: "destructive" });
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    let reason = "";
    if (status === 'rejected') {
      reason = prompt("Enter reason for rejection:");
      if (!reason) return;
    }

    try {
      await API.patch(`/admin/withdrawals/${id}`, { status, reason });
      toast({ title: "Success", description: `Withdrawal request ${status}` });
      fetchWithdrawals(); // Refresh
    } catch (error) {
      toast({ title: "Error", description: error.response?.data?.message || "Action failed", variant: "destructive" });
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => 
    w.providerId?.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.providerId?.ownerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Withdrawal Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage provider payout requests.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-black text-sm uppercase tracking-wider text-gray-900">Pending & Past Requests</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by Shop Name..." 
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
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Bank Details</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No withdrawal requests found.</td>
                </tr>
              ) : filteredWithdrawals.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{item.providerId?.shopName || "N/A"}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{item.providerId?.ownerName || "N/A"}</p>
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-600">₹{item.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-700">
                    <p>{item.bankDetails?.bankName}</p>
                    <p className="text-gray-500 font-mono text-[11px]">{item.bankDetails?.accountNumber}</p>
                    <p className="text-gray-400 text-[10px]">{item.bankDetails?.ifscCode}</p>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider block w-fit ${
                      item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                      item.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {item.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleStatusUpdate(item._id, 'approved')} 
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(item._id, 'rejected')} 
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
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

export default AdminWithdrawals;
