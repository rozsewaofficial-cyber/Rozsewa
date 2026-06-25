import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import {
    Plus, Edit, Trash2, Search, MapPin, CheckCircle,
    XCircle, Clock, Star, AlertTriangle, Loader2, ShieldCheck,
    MoreVertical, X, FileText, CreditCard, Camera, Users, ShieldAlert, CheckCircle2, Ban
} from "lucide-react";

import API from "@/lib/api";

const statusStyles = {
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    suspended: "bg-gray-50 text-gray-700 border-gray-200",
};

const AdminProviders = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("all");
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);

    useScrollLock(!!selectedProvider || showStatusModal);

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

    const stats = useMemo(() => {
        return {
            total: providers.length,
            verified: providers.filter(p => p.status === 'verified').length,
            pending: providers.filter(p => p.status === 'pending').length,
            suspended: providers.filter(p => p.status === 'suspended').length
        };
    }, [providers]);

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

    if (loading && providers.length === 0) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Syncing with Providers DB...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Service Providers</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Verify applications and manage active provider accounts.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Providers", value: stats.total, icon: Users, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Verified Active", value: stats.verified, icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Pending Review", value: stats.pending, icon: AlertTriangle, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Suspended", value: stats.suspended, icon: Ban, cls: "text-red-700 bg-red-50 border-red-200" },
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

            {/* Action Required Banner */}
            {filter === "all" && stats.pending > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-black text-amber-900">Action Required</h3>
                        <p className="text-xs text-amber-700 font-bold tracking-tight mt-0.5">There are {stats.pending} new applications awaiting your review.</p>
                    </div>
                    <button
                        onClick={() => setFilter("pending")}
                        className="shrink-0 rounded-lg bg-white border border-amber-200 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-amber-700 shadow-sm hover:bg-amber-100 transition-all active:scale-95"
                    >
                        Review Now
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search shop, owner, code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-bold placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm outline-none"
                    />
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm overflow-x-auto">
                    {["all", "pending", "verified", "rejected", "suspended"].map((f) => (
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

            {/* Providers Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Provider Info</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Details</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Settings</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-center">Rating</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredProviders.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-100 shadow-sm">
                                            <Search className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-900">No providers match your filter</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProviders.map((provider) => (
                                    <tr key={provider._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4 max-w-[280px] align-middle">
                                            <div className="flex items-center gap-3">
                                                <div className="flex shrink-0 h-10 w-10 items-center justify-center rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shadow-sm">
                                                    {provider.profileImage ? (
                                                        <img src={provider.profileImage} alt={provider.shopName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-xl font-black text-gray-400 uppercase">{provider.shopName?.charAt(0)}</span>
                                                    )}
                                                </div>
                                                <div className="overflow-hidden pt-0.5">
                                                    <p className="font-extrabold text-gray-900 truncate" title={provider.shopName}>{provider.shopName}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{provider.ownerName}</p>
                                                        <span className="text-gray-300">•</span>
                                                        <p className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">{provider.vendorCode}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="space-y-1">
                                                <div>
                                                    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-600 border border-gray-200">
                                                        {provider.vendorType || 'Unknown'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-1 mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                    <span className="flex items-center gap-1.5 truncate" title={provider.address}>
                                                        <MapPin className="h-3 w-3 shrink-0" /> {provider.address ? (provider.address.length > 20 ? provider.address.slice(0, 20) + '...' : provider.address) : 'N/A'}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3 shrink-0" /> {new Date(provider.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div className="flex flex-col gap-2.5 w-36">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Provider Role</label>
                                                    <select
                                                        value={provider.providerCategory || 'partner'}
                                                        onChange={(e) => handleUpdateCategory(provider._id, e.target.value)}
                                                        className="w-full bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest rounded-md px-2 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 cursor-pointer shadow-sm transition-all"
                                                    >
                                                        <option value="partner">Partner</option>
                                                        <option value="sewak">Sewak</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center align-middle">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-100 text-[10px] font-black text-amber-700">
                                                    {provider.rating ? provider.rating.toFixed(1) : '0.0'} <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                                </div>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">{provider.reviewCount || 0} reviews</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <div>
                                                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border ${statusStyles[provider.status] || statusStyles.pending}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${provider.status === 'verified' ? 'bg-emerald-500' :
                                                        provider.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                                                        }`}></span>
                                                    {provider.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right align-middle">
                                            <div className="flex items-center justify-end gap-2">
                                                {provider.status === "pending" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(provider._id, "verified")}
                                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                                            title="Approve"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(provider._id, "rejected")}
                                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {provider.status === "verified" && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(provider._id, "suspended")}
                                                        className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                {provider.status === "suspended" && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(provider._id, "verified")}
                                                        className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                                                    >
                                                        Unsuspend
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteProvider(provider._id)}
                                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-50 text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Delete Provider"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedProvider(provider)}
                                                    className="h-8 px-3 rounded-lg bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 transition-colors"
                                                >
                                                    Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Provider Details Drawer */}
            <AnimatePresence>
                {selectedProvider && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setSelectedProvider(null)} />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 z-[101] w-full max-w-xl bg-white shadow-2xl flex flex-col border-l border-gray-200">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">Provider Profile</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Application Details & Docs</p>
                                </div>
                                <button onClick={() => setSelectedProvider(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"><X className="h-4 w-4" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* Profile Head */}
                                <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 border border-gray-200 shadow-sm text-gray-700 font-black text-2xl uppercase overflow-hidden">
                                        {selectedProvider.profileImage ? (
                                            <img src={selectedProvider.profileImage} alt={selectedProvider.shopName} className="h-full w-full object-cover" />
                                        ) : (
                                            selectedProvider.shopName?.charAt(0)
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{selectedProvider.shopName}</h4>
                                        <p className="text-sm font-bold text-gray-500">{selectedProvider.ownerName}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${statusStyles[selectedProvider.status]}`}>
                                                {selectedProvider.status}
                                            </span>
                                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700 border border-blue-100">
                                                {selectedProvider.providerCategory}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Contact Info</h4>
                                        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <div className="flex justify-between"><span className="text-[9px] font-black uppercase text-gray-500">Mobile</span><span className="text-xs font-bold text-gray-900">{selectedProvider.mobile}</span></div>
                                            <div className="flex justify-between"><span className="text-[9px] font-black uppercase text-gray-500">Email</span><span className="text-xs font-bold text-gray-900 truncate max-w-[100px]">{selectedProvider.email || 'N/A'}</span></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">KYC Details</h4>
                                        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <div className="flex justify-between"><span className="text-[9px] font-black uppercase text-gray-500">Aadhaar</span><span className="text-xs font-bold text-gray-900">{selectedProvider.kycAadhaar || 'N/A'}</span></div>
                                            <div className="flex justify-between"><span className="text-[9px] font-black uppercase text-gray-500">PAN</span><span className="text-xs font-bold text-gray-900">{selectedProvider.kycPanNumber || 'N/A'}</span></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Bank Information</h4>
                                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                                        <div>
                                            <span className="text-[9px] block font-black uppercase text-gray-500 mb-1">A/C Holder</span>
                                            <span className="text-xs font-bold text-gray-900">{selectedProvider.bankDetails?.accountHolderName || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] block font-black uppercase text-gray-500 mb-1">A/C Number</span>
                                            <span className="text-xs font-bold text-gray-900">{selectedProvider.bankDetails?.accountNumber || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] block font-black uppercase text-gray-500 mb-1">IFSC Code</span>
                                            <span className="text-xs font-bold text-gray-900">{selectedProvider.bankDetails?.ifscCode || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] block font-black uppercase text-gray-500 mb-1">Bank Name</span>
                                            <span className="text-xs font-bold text-gray-900">{selectedProvider.bankDetails?.bankName || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Identity Documents</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {[
                                            { label: "Profile", url: selectedProvider.profileImage },
                                            { label: "Aadhaar Front", url: selectedProvider.kycAadhaarPhoto },
                                            { label: "Aadhaar Back", url: selectedProvider.kycAadhaarBackPhoto },
                                            { label: "PAN Card", url: selectedProvider.kycPanPhoto }
                                        ].map((doc, idx) => (
                                            <div key={idx} className="flex flex-col gap-1.5 p-2 rounded-xl bg-gray-50 border border-gray-100">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 text-center">{doc.label}</span>
                                                {doc.url ? (
                                                    <a href={doc.url} target="_blank" rel="noreferrer" className="block h-24 rounded-lg overflow-hidden hover:opacity-80 transition-opacity border border-gray-200">
                                                        <img src={doc.url} alt={doc.label} className="h-full w-full object-cover" />
                                                    </a>
                                                ) : (
                                                    <div className="flex h-24 items-center justify-center rounded-lg bg-gray-100 border border-dashed border-gray-200">
                                                        <span className="text-[9px] font-black uppercase text-gray-400">Missing</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminProviders;
