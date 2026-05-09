import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import {
  Search, ShieldCheck, XCircle, Clock, Star, Loader2, CreditCard, CalendarDays, Percent, IndianRupee
} from "lucide-react";
import API from "@/lib/api";

const AdminProviderSubscriptions = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setTitle("Provider Subscriptions");
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
        description: err.response?.data?.message || "Could not load provider subscriptions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      
    let matchesFilter = true;
    if (filter === "subscribed") matchesFilter = p.isSubscribed;
    if (filter === "free") matchesFilter = !p.isSubscribed;
    if (filter === "expired") matchesFilter = p.isSubscribed && p.subscriptionExpiry && new Date(p.subscriptionExpiry) < new Date();
    
    return matchesSearch && matchesFilter;
  });

  const handleRevokeSubscription = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this provider's subscription?")) return;
    try {
      // Opting to use a quick PUT request to update the provider directly via a status route or we can make a dedicated route if needed. 
      // For now, let's assume we can update provider details via existing endpoints or we just mock the UI update if no dedicated endpoint exists yet.
      // Since we don't have a specific revoke route, let's rely on the update plan route if possible, or just note it's a future feature.
      toast({ title: "Feature Coming Soon", description: "Revoke subscription endpoint needed." });
    } catch (err) {
      toast({ title: "Update Failed", variant: "destructive" });
    }
  }

  if (loading) return (
    <div className="flex h-96 flex-col items-center justify-center space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      <p className="text-sm font-bold text-slate-500">Loading Subscription Data...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] border border-blue-50 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
           {["all", "subscribed", "free", "expired"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
              >
                {f}
              </button>
            ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProviders.length === 0 ? (
          <div className="col-span-full bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-100">
            <CreditCard className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-900">No Providers Found</h3>
            <p className="text-sm font-bold text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filteredProviders.map((provider) => {
            const isSubscribed = provider.isSubscribed;
            const expiryDate = provider.subscriptionExpiry ? new Date(provider.subscriptionExpiry) : null;
            const purchaseDate = provider.subscriptionPurchaseDate ? new Date(provider.subscriptionPurchaseDate) : null;
            const isExpired = isSubscribed && expiryDate && expiryDate < new Date();
            
            return (
            <motion.div
              layout
              key={provider._id}
              className={`bg-white rounded-[2.5rem] border ${isSubscribed && !isExpired ? 'border-emerald-100' : isExpired ? 'border-red-100' : 'border-slate-100'} p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden`}
            >
              {/* Background Glow */}
              {isSubscribed && !isExpired && <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />}
              {isExpired && <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />}

              <div className="relative z-10 flex items-start gap-4 mb-6">
                <div className="flex shrink-0 h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 shadow-inner overflow-hidden">
                  {provider.profileImage ? (
                    <img src={provider.profileImage} alt={provider.shopName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-slate-400">{provider.shopName?.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-900 truncate">{provider.shopName}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="shrink-0 inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-blue-600 border border-blue-100">
                      {provider.providerCategory === 'sewak' ? 'Sewak' : 'Partner'}
                    </span>
                    <span className="shrink-0 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-600 border border-slate-200">
                      {provider.businessType || 'General'}
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{provider.ownerName}</p>
                  <p className="text-[9px] font-mono text-slate-300 mt-0.5">{provider.vendorCode}</p>
                </div>
                
                {/* Status Badge */}
                <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  isSubscribed && !isExpired ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                  isExpired ? 'bg-red-50 text-red-600 border-red-200' : 
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {isSubscribed && !isExpired && <><ShieldCheck className="h-3 w-3" /> Active</>}
                  {isExpired && <><XCircle className="h-3 w-3" /> Expired</>}
                  {!isSubscribed && <><CreditCard className="h-3 w-3" /> Free</>}
                </div>
              </div>

              <div className="relative z-10 space-y-4 bg-slate-50 p-4 rounded-[1.5rem]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                      <Star className="h-3 w-3" /> Plan Type
                    </p>
                    <p className={`text-sm font-black ${isSubscribed ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {isSubscribed ? `${provider.planType || 'Elite'} Member` : 'Basic Access'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                      <Percent className="h-3 w-3" /> Commission
                    </p>
                    <p className="text-sm font-black text-slate-700">
                      {provider.commissionRate || (isSubscribed ? '5' : '15')}% Rate
                    </p>
                  </div>
                </div>

                {isSubscribed && (
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <CalendarDays className="h-3 w-3" /> Purchased
                      </p>
                      <p className="text-xs font-black text-slate-900">
                        {purchaseDate ? purchaseDate.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <CalendarDays className="h-3 w-3" /> Expiry
                      </p>
                      <p className={`text-xs font-black ${isExpired ? 'text-red-600' : 'text-slate-900'}`}>
                        {expiryDate ? expiryDate.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <IndianRupee className="h-3 w-3" /> Price Paid
                      </p>
                      <p className="text-xs font-black text-emerald-600">
                        {provider.subscriptionPrice ? `₹${provider.subscriptionPrice}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )})
        )}
      </div>
    </div>
  );
};

export default AdminProviderSubscriptions;
