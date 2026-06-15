import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
    Search, ShieldCheck, XCircle, CreditCard, CalendarDays, Percent, IndianRupee, Users, ArrowLeft, Loader2
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

    const stats = useMemo(() => {
        let subscribed = 0;
        let free = 0;
        let expired = 0;

        providers.forEach(p => {
            if (p.isSubscribed) {
                const expiryDate = p.subscriptionExpiry ? new Date(p.subscriptionExpiry) : null;
                if (expiryDate && expiryDate < new Date()) {
                    expired++;
                } else {
                    subscribed++;
                }
            } else {
                free++;
            }
        });

        return { total: providers.length, subscribed, free, expired };
    }, [providers]);

    const filteredProviders = (providers || []).filter(p => {
        const sName = p?.shopName || "";
        const oName = p?.ownerName || "";
        const pId = p?.vendorCode || p?._id || "";
        const search = (searchTerm || "").toLowerCase();

        const matchesSearch = sName.toLowerCase().includes(search) ||
            oName.toLowerCase().includes(search) ||
            pId.toLowerCase().includes(search);

        let matchesFilter = true;
        if (filter === "subscribed") {
            const isExpired = p.isSubscribed && p.subscriptionExpiry && new Date(p.subscriptionExpiry) < new Date();
            matchesFilter = p.isSubscribed && !isExpired;
        }
        if (filter === "free") matchesFilter = !p.isSubscribed;
        if (filter === "expired") matchesFilter = p.isSubscribed && p.subscriptionExpiry && new Date(p.subscriptionExpiry) < new Date();

        return matchesSearch && matchesFilter;
    });

    const handleRevokeSubscription = async (id) => {
        if (!window.confirm("Are you sure you want to revoke this provider's subscription?")) return;
        try {
            // Placeholder for real endpoint
            toast({ title: "Feature Coming Soon", description: "Revoke subscription endpoint needed." });
        } catch (err) {
            toast({ title: "Update Failed", variant: "destructive" });
        }
    };

    if (loading && providers.length === 0) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Subscriptions...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Provider Subscriptions</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage and track vendor membership plans and expiry dates.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Providers", value: stats.total, icon: Users, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Active Subscriptions", value: stats.subscribed, icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Free / Basic Plans", value: stats.free, icon: CreditCard, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Expired Plans", value: stats.expired, icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
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

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by shop, owner or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-bold placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm outline-none"
                    />
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm overflow-x-auto">
                    {['all', 'subscribed', 'free', 'expired'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900">Subscription Registry</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current plan statuses</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Provider Info</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Plan Details</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Validity</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProviders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-100 shadow-sm">
                                            <Search className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">No providers found</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProviders.map((provider) => {
                                    const isSubscribed = provider.isSubscribed;
                                    const expiryDate = provider.subscriptionExpiry ? new Date(provider.subscriptionExpiry) : null;
                                    const purchaseDate = provider.subscriptionPurchaseDate ? new Date(provider.subscriptionPurchaseDate) : null;
                                    const isExpired = isSubscribed && expiryDate && expiryDate < new Date();

                                    return (
                                        <tr key={provider._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-black text-lg uppercase tracking-tighter shadow-sm overflow-hidden">
                                                        {provider.profileImage ? (
                                                            <img src={provider.profileImage} alt={provider.shopName} className="h-full w-full object-cover" />
                                                        ) : (
                                                            provider.shopName?.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-extrabold text-gray-900 tracking-tight">{provider.shopName}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{provider.vendorCode}</span>
                                                            <span className="text-gray-300">•</span>
                                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{provider.ownerName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest w-12">Plan</span>
                                                        <span className={`text-xs font-black ${isSubscribed ? 'text-emerald-700' : 'text-gray-700'}`}>
                                                            {isSubscribed ? `${provider.planType || 'Elite'} Member` : 'Basic Access'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest w-12">Fee</span>
                                                        <span className="text-xs font-bold text-gray-900">
                                                            {provider.commissionRate || (isSubscribed ? '5' : '15')}% Commission
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isSubscribed ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <CalendarDays className="h-3 w-3 text-gray-400" />
                                                            <span className="text-[10px] font-bold text-gray-900">
                                                                {purchaseDate ? purchaseDate.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-[10px] font-bold ${isExpired ? 'text-red-600' : 'text-gray-500'}`}>
                                                                Exp: {expiryDate ? expiryDate.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">No Active Plan</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                                    isSubscribed && !isExpired ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    isExpired ? 'bg-red-50 text-red-700 border-red-100' :
                                                    'bg-gray-50 text-gray-600 border-gray-200'
                                                }`}>
                                                    {isSubscribed && !isExpired && <><ShieldCheck className="h-3 w-3" /> Active</>}
                                                    {isExpired && <><XCircle className="h-3 w-3" /> Expired</>}
                                                    {!isSubscribed && <><CreditCard className="h-3 w-3" /> Free</>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleRevokeSubscription(provider._id)}
                                                    disabled={!isSubscribed}
                                                    className={`h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                                                        isSubscribed 
                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                                        : 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                                                    }`}
                                                >
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminProviderSubscriptions;
