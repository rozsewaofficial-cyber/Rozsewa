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
  
  const handleUpdateCategory = async (id, newCategory) => {
    try {
      const { data } = await API.put(`/admin/providers/${id}/category-role`, { providerCategory: newCategory });
      setProviders(providers.map(p => p._id === id ? { ...p, providerCategory: newCategory } : p));
      toast({ title: "Category Updated", description: `Provider role changed to ${newCategory}.` });
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
    if (!window.confirm("Are you sure you want to remove this provider? This action cannot be undone.")) return;
    try {
      await API.delete(`/admin/providers/${id}`);
      setProviders(providers.filter(p => p._id !== id));
      toast({ title: "Provider Removed", description: "Provider and associated data deleted successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete provider", variant: "destructive" });
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
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs font-semibold">
              <tr>
                <th className="py-4 px-6">Provider</th>
                <th className="py-4 px-6">Details</th>
                <th className="py-4 px-6">Settings</th>
                <th className="py-4 px-6 text-center">Rating</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProviders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center">
                        <Search className="h-8 w-8 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium text-base">No providers match your filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProviders.map((provider) => (
                  <motion.tr key={provider._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50/80 transition-colors group">
                    {/* Provider Column */}
                    <td className="py-5 px-6 max-w-[280px]">
                      <div className="flex items-center gap-4">
                        <div className="flex shrink-0 h-14 w-14 items-center justify-center rounded-xl bg-gray-100 border border-gray-200 overflow-hidden relative">
                          {provider.profileImage ? (
                            <img src={provider.profileImage} alt={provider.shopName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-gray-400">{provider.shopName?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-gray-900 truncate text-base" title={provider.shopName}>{provider.shopName}</p>
                          <p className="text-sm font-medium text-emerald-600 truncate">{provider.ownerName}</p>
                          <p className="text-xs font-mono text-gray-400 mt-0.5 uppercase">{provider.vendorCode}</p>
                        </div>
                      </div>
                    </td>

                    {/* Details Column */}
                    <td className="py-5 px-6">
                      <div className="flex flex-col gap-2">
                        <div>
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-100">
                            {provider.vendorType || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5 truncate" title={provider.address}>
                            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" /> {provider.address ? (provider.address.length > 25 ? provider.address.slice(0, 25) + '...' : provider.address) : 'N/A'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" /> Joined {new Date(provider.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Settings Column */}
                    <td className="py-5 px-6">
                      <div className="flex flex-col gap-2.5 w-40">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Plan Type</label>
                          <select
                            value={provider.planType || 'basic'}
                            onChange={(e) => handleUpdatePlan(provider._id, e.target.value)}
                            className="bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                          >
                            <option value="basic">Basic (25%)</option>
                            <option value="standard">Standard (20%)</option>
                            <option value="premium">Premium (15%)</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Category Role</label>
                          <select
                            value={provider.providerCategory || 'partner'}
                            onChange={(e) => handleUpdateCategory(provider._id, e.target.value)}
                            className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                          >
                            <option value="partner">Partner</option>
                            <option value="sewak">Sewak</option>
                          </select>
                        </div>
                      </div>
                    </td>

                    {/* Rating Column */}
                    <td className="py-5 px-6 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-900 border border-gray-100">
                          {provider.rating ? provider.rating.toFixed(1) : '0.0'} <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-500">{provider.reviewCount || 0} reviews</span>
                      </div>
                    </td>

                    {/* Status Column */}
                    <td className="py-5 px-6">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[provider.status] || statusStyles.pending}`}>
                        <span className={`h-2 w-2 rounded-full ${provider.status === 'verified' ? 'bg-emerald-500' :
                          provider.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                          }`}></span>
                        <span className="capitalize">{provider.status}</span>
                      </span>
                    </td>

                    {/* Actions Column */}
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {provider.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(provider._id, "verified")}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-semibold border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm"
                              title="Approve"
                            >
                              <CheckCircle className="h-4 w-4" /> Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(provider._id, "rejected")}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-50 text-red-700 px-3 py-1.5 text-xs font-semibold border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm"
                              title="Reject Application"
                            >
                              <XCircle className="h-4 w-4" /> Reject
                            </button>
                          </>
                        )}
                        {provider.status === "verified" && (
                          <button
                            onClick={() => handleUpdateStatus(provider._id, "suspended")}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 text-amber-700 px-3 py-1.5 text-xs font-semibold border border-amber-200 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-sm"
                            title="Suspend Provider"
                          >
                            <ShieldCheck className="h-4 w-4" /> Suspend
                          </button>
                        )}
                        <button
                          onClick={() => deleteProvider(provider._id)}
                          className="inline-flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 p-2 border border-gray-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm"
                          title="Delete Provider"
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
