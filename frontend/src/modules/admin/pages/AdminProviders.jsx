import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Edit, Trash2, Search, MapPin, CheckCircle,
  XCircle, Clock, Star, AlertTriangle, Loader2, ShieldCheck
} from "lucide-react";

import API from "@/lib/api";

const statusStyles = {
  verified: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  suspended: "bg-gray-50 text-gray-700 border border-gray-200",
};

const AdminProviders = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setTitle("Manage Providers");
    fetchProviders();
  }, [setTitle]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/admin/providers");
      setProviders(data);
    } catch (err) {
      toast({
        title: "Fetch Failed",
        description: err.response?.data?.message || "Could not load providers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const { data } = await API.put(`/admin/providers/${id}/status`, { status: newStatus });
      setProviders(providers.map(p => p._id === id ? data : p));
      toast({ title: "Status Updated", description: `Provider is now ${newStatus}.` });
    } catch (err) {
      toast({ title: "Update Failed", variant: "destructive" });
    }
  };

  const handleUpdatePlan = async (id, newPlan) => {
    try {
      const { data } = await API.put(`/admin/providers/${id}/plan`, { planType: newPlan });
      setProviders(providers.map(p => p._id === id ? { ...p, planType: newPlan } : p));
      toast({ title: "Plan Updated", description: `Provider plan changed to ${newPlan}.` });
    } catch (err) {
      toast({ title: "Plan Update Failed", variant: "destructive" });
    }
  };

  const deleteProvider = async (id) => {
    if (!window.confirm("Are you sure you want to remove this provider?")) return;
    try {
      // Assuming a delete route exists or using update status to suspended
      toast({ title: "Provider Removed", description: "This feature is coming soon." });
    } catch (err) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const filteredProviders = (providers || []).filter(p => {
    const sName = p?.shopName || "";
    const oName = p?.ownerName || "";
    const pId = p?.vendorCode || p?._id || "";
    const search = (searchTerm || "").toLowerCase();

    const matchesSearch = sName.toLowerCase().includes(search) ||
      oName.toLowerCase().includes(search) ||
      pId.toLowerCase().includes(search);
    const matchesFilter = filter === "all" || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      <p className="text-sm font-bold text-gray-500">Syncing with Providers DB...</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Service Providers</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">Verify applications and manage active provider accounts.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex rounded-xl bg-gray-100 p-1 shrink-0 shadow-inner">
            {["all", "pending", "verified", "rejected", "suspended"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] md:min-w-[300px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
              placeholder="Search shop, owner, code..."
            />
          </div>
        </div>
      </div>

      {filter === "all" && providers.some(p => p.status === "pending") && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm flex items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-amber-900">Action Required</h3>
            <p className="text-xs text-amber-700 font-bold tracking-tight">There are {providers.filter(p => p.status === "pending").length} new applications awaiting your review.</p>
          </div>
          <button
            onClick={() => setFilter("pending")}
            className="shrink-0 rounded-xl bg-white border border-amber-200 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 shadow-sm hover:bg-amber-100 transition-all active:scale-95"
          >
            Review Now
          </button>
        </div>
      )}

      {/* Providers Table */}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-400 uppercase tracking-widest text-[9px] font-black">
              <tr>
                <th className="py-5 px-6">Provider Info</th>
                <th className="py-5 px-6">Industry & Category</th>
                <th className="py-5 px-6 text-center">Stats</th>
                <th className="py-5 px-6">Status</th>
                <th className="py-5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProviders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-10 w-10 text-gray-200" />
                      <p className="text-gray-400 font-bold text-sm tracking-tight">No providers match your filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProviders.map((provider) => (
                  <motion.tr key={provider._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-emerald-50/20 transition-colors group">
                    <td className="py-4 px-6 max-w-[280px]">
                      <div className="flex items-center gap-4">
                        <div className="flex shrink-0 h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border-2 border-white shadow-md overflow-hidden transform group-hover:scale-105 transition-transform">
                          {provider.profileImage ? (
                            <img src={provider.profileImage} alt={provider.shopName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-lg font-black text-emerald-700">{provider.shopName?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-extrabold text-gray-900 truncate tracking-tight text-sm" title={provider.shopName}>{provider.shopName}</p>
                          <p className="text-[10px] font-bold text-emerald-600 truncate uppercase tracking-wider">{provider.ownerName}</p>
                          <p className="text-[9px] font-mono text-gray-400 mt-1 uppercase tracking-tighter">{provider.vendorCode}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700 border border-blue-100">
                            {provider.vendorType}
                          </span>
                          <select
                            value={provider.planType || 'basic'}
                            onChange={(e) => handleUpdatePlan(provider._id, e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-[9px] font-black uppercase rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="basic">Basic (25%)</option>
                            <option value="standard">Standard (20%)</option>
                            <option value="premium">Premium (15%)</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-0.5 text-[10px] text-gray-500 font-bold tracking-tight">
                          <span className="flex items-center gap-1.5 truncate"><MapPin className="h-3 w-3 text-gray-400" /> {provider.address?.slice(0, 30)}...</span>
                          <span className="flex items-center gap-1.5 text-gray-400"><Clock className="h-3 w-3" /> Joined {new Date(provider.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl text-[11px] font-black text-gray-900 border-2 border-gray-50 shadow-sm">
                          {provider.rating ? provider.rating.toFixed(1) : '0.0'} <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        </div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">{provider.reviewCount || 0} reviews</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] ${statusStyles[provider.status]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${provider.status === 'verified' ? 'bg-emerald-500' :
                          provider.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                          }`}></span>
                        {provider.status}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {provider.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(provider._id, "verified")}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(provider._id, "rejected")}
                              className="p-2.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border border-transparent hover:border-red-100"
                              title="Reject Application"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        )}
                        {provider.status === "verified" && (
                          <button
                            onClick={() => handleUpdateStatus(provider._id, "suspended")}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-600 border border-gray-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Suspend
                          </button>
                        )}
                        <button
                          onClick={() => deleteProvider(provider._id)}
                          className="p-2.5 text-gray-300 hover:text-red-400 hover:bg-red-50/50 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminProviders;
