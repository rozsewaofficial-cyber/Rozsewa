import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
    Search, ShieldCheck, XCircle, CreditCard, CalendarDays, Users, Loader2, 
    Crown, Plus, X, Sparkles, AlertCircle, RefreshCw, Filter, User
} from "lucide-react";
import API from "@/lib/api";

const AdminProviderSubscriptions = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [providers, setProviders] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filter, setFilter] = useState("all"); // "all", "subscribed", "free", "expired"
    const [roleFilter, setRoleFilter] = useState("all"); // "all", "partner", "sewak"

    // Manual Subscription Modal State
    const [modalProvider, setModalProvider] = useState(null);
    const [selectedPlanId, setSelectedPlanId] = useState("");
    const [customExpiry, setCustomExpiry] = useState(""); // YYYY-MM-DD
    const [displayDate, setDisplayDate] = useState(""); // DD/MM/YYYY
    const [assignReason, setAssignReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setTitle("Provider & Sewak Subscriptions");
        fetchInitialData();
    }, [setTitle]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [providersRes, plansRes] = await Promise.all([
                API.get("/admin/providers"),
                API.get("/admin/subscriptions")
            ]);
            setProviders(providersRes.data || []);
            setPlans(plansRes.data || []);
        } catch (err) {
            toast({
                title: "Fetch Failed",
                description: err.response?.data?.message || "Could not load subscription data",
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
        let partners = 0;
        let sewaks = 0;

        providers.forEach(p => {
            const isSewak = p.providerCategory === 'sewak';
            if (isSewak) sewaks++;
            else partners++;

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

        return { total: providers.length, subscribed, free, expired, partners, sewaks };
    }, [providers]);

    const filteredProviders = useMemo(() => {
        return (providers || []).filter(p => {
            const sName = p?.shopName || "";
            const oName = p?.ownerName || "";
            const pId = p?.vendorCode || p?._id || "";
            const search = (searchTerm || "").toLowerCase();

            const matchesSearch = sName.toLowerCase().includes(search) ||
                oName.toLowerCase().includes(search) ||
                pId.toLowerCase().includes(search);

            // Role filter
            let matchesRole = true;
            if (roleFilter === "sewak") matchesRole = p.providerCategory === "sewak";
            if (roleFilter === "partner") matchesRole = p.providerCategory !== "sewak";

            // Status filter
            let matchesFilter = true;
            if (filter === "subscribed") {
                const isExpired = p.isSubscribed && p.subscriptionExpiry && new Date(p.subscriptionExpiry) < new Date();
                matchesFilter = p.isSubscribed && !isExpired;
            }
            if (filter === "free") matchesFilter = !p.isSubscribed;
            if (filter === "expired") matchesFilter = p.isSubscribed && p.subscriptionExpiry && new Date(p.subscriptionExpiry) < new Date();

            return matchesSearch && matchesRole && matchesFilter;
        });
    }, [providers, searchTerm, filter, roleFilter]);

    const formatToDDMMYYYY = (isoDateStr) => {
        if (!isoDateStr) return "";
        const parts = isoDateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return isoDateStr;
    };

    const handleDateTextChange = (e) => {
        const val = e.target.value;
        setDisplayDate(val);
        const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            const iso = `${year}-${month}-${day}`;
            if (!isNaN(new Date(iso).getTime())) {
                setCustomExpiry(iso);
            }
        } else if (val.trim() === "") {
            setCustomExpiry("");
        }
    };

    const handleOpenAssignModal = (provider) => {
        setModalProvider(provider);
        setSelectedPlanId("");
        setCustomExpiry("");
        setDisplayDate("");
        setAssignReason("");
    };

    const handleAssignSubscription = async () => {
        if (!modalProvider || !selectedPlanId) {
            toast({ title: "Validation Error", description: "Please select a subscription plan", variant: "destructive" });
            return;
        }

        if (customExpiry) {
            const expDate = new Date(customExpiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expDate <= today) {
                toast({ title: "Invalid Expiry Date", description: "Expiry date must be in the future (tomorrow or later).", variant: "destructive" });
                return;
            }
        }

        setSubmitting(true);
        try {
            await API.post(`/v2/admin/providers/${modalProvider._id}/subscription/manual`, {
                planId: selectedPlanId,
                expiryDate: customExpiry || undefined,
                reason: assignReason || undefined
            });

            toast({ title: "Subscription Activated", description: `Plan successfully assigned to ${modalProvider.shopName}` });
            setModalProvider(null);
            fetchInitialData();
        } catch (err) {
            toast({
                title: "Activation Failed",
                description: err.response?.data?.message || "Failed to assign subscription",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevokeSubscription = async (id) => {
        const reason = window.prompt("Enter a reason for revoking the subscription (optional):");
        if (reason === null) return;
        
        try {
            await API.post(`/v2/admin/providers/${id}/subscription/cancel`, { reason });
            toast({ title: "Subscription Revoked", description: "Provider's subscription has been cancelled." });
            fetchInitialData();
        } catch (err) {
            toast({ 
                title: "Update Failed", 
                description: err.response?.data?.message || "Failed to revoke subscription",
                variant: "destructive" 
            });
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
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Provider & Sewak Subscriptions</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage, grant, and audit membership plans for Partners and Sewaks.</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="/admin/subscriptions" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm transition-all flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Create / Manage Plans
                    </a>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: `Total Providers (${stats.partners} Partners, ${stats.sewaks} Sewaks)`, value: stats.total, icon: Users, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Active Subscriptions", value: stats.subscribed, icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Free / Basic Plans", value: stats.free, icon: CreditCard, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Expired Plans", value: stats.expired, icon: XCircle, cls: "text-red-700 bg-red-50 border-red-200" },
                ].map((s, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${s.cls}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <s.icon className="h-3.5 w-3.5 opacity-70" />
                            <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">{s.label}</p>
                        </div>
                        <h3 className="text-2xl font-black">{s.value}</h3>
                    </div>
                ))}
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by shop, owner or vendor ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm font-bold placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm outline-none"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Role Filter */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <span className="text-[9px] font-black uppercase text-gray-400 px-2 tracking-widest">Role:</span>
                        {[
                            { id: "all", label: "All Roles" },
                            { id: "partner", label: "Partners Only" },
                            { id: "sewak", label: "Sewaks Only" }
                        ].map(rf => (
                            <button
                                key={rf.id}
                                onClick={() => setRoleFilter(rf.id)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${roleFilter === rf.id ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                {rf.label}
                            </button>
                        ))}
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
                        {['all', 'subscribed', 'free', 'expired'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Subscription Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase">Subscription Registry</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current plan statuses & roles</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Provider / Sewak Info</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Target Role</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Plan Details</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Validity</th>
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
                                        <p className="text-sm font-bold text-gray-900">No matching providers found</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Try adjusting search or role filters</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProviders.map((provider) => {
                                    const isSubscribed = provider.isSubscribed;
                                    const isSewak = provider.providerCategory === 'sewak';
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
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{provider.vendorCode || provider._id}</span>
                                                            <span className="text-gray-300">•</span>
                                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{provider.ownerName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                    isSewak 
                                                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                                    : 'bg-purple-50 text-purple-800 border-purple-200'
                                                }`}>
                                                    {isSewak ? 'Sewak' : 'Partner Provider'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest w-10">Plan:</span>
                                                        <span className={`text-xs font-black ${isSubscribed ? 'text-emerald-700' : 'text-gray-700'}`}>
                                                            {isSubscribed ? `${provider.planType || 'Elite'} Member` : 'Basic Access'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest w-10">Rate:</span>
                                                        <span className="text-xs font-bold text-gray-900">
                                                            {provider.commissionRate !== undefined ? `${provider.commissionRate}% Commission` : (isSubscribed ? 'Custom Plan' : 'Standard')}
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
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenAssignModal(provider)}
                                                        className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <Crown className="h-3.5 w-3.5" />
                                                        {isSubscribed ? 'Change Plan' : 'Grant Plan'}
                                                    </button>
                                                    {isSubscribed && (
                                                        <button
                                                            onClick={() => handleRevokeSubscription(provider._id)}
                                                            className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                        >
                                                            Revoke
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grant / Change Subscription Modal */}
            {modalProvider && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 p-4 backdrop-blur-md" onClick={() => setModalProvider(null)}>
                    <div className="w-full max-w-lg rounded-3xl bg-white p-6 md:p-8 shadow-2xl space-y-6 relative border border-gray-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setModalProvider(null)}
                            className="absolute top-6 right-6 h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider mb-2 border border-blue-100">
                                <Crown className="h-3.5 w-3.5" /> Manual Subscription Assignment
                            </div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">
                                Assign Plan: {modalProvider.shopName}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Owner: <strong className="text-gray-800">{modalProvider.ownerName}</strong> ({modalProvider.providerCategory === 'sewak' ? 'Sewak' : 'Partner Provider'})
                            </p>
                        </div>

                        <div className="space-y-4 text-left">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                                    Select Subscription Plan *
                                </label>
                                <select
                                    value={selectedPlanId}
                                    onChange={(e) => setSelectedPlanId(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">-- Select a Plan --</option>
                                    {plans.map((p) => {
                                        const targetCategory = p.providerCategory === 'sewak' ? 'Sewak Only' : (p.providerCategory === 'partner' ? 'Partner Only' : 'All Roles');
                                        return (
                                            <option key={p._id} value={p._id}>
                                                {p.name} — ₹{p.price} ({p.duration || 365} Days, {p.commissionRate || p.offeredCommissionRate}% Commission) [{targetCategory}]
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500">
                                        Custom Expiry Date (Optional)
                                    </label>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                        Format: DD/MM/YYYY
                                    </span>
                                </div>
                                <div className="relative flex items-center">
                                    <input
                                        type="text"
                                        placeholder="DD/MM/YYYY (e.g. 24/07/2026)"
                                        value={displayDate}
                                        onChange={handleDateTextChange}
                                        className="w-full rounded-xl border border-gray-300 p-3 pr-12 text-sm font-bold text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer overflow-hidden">
                                        <input
                                            type="date"
                                            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                                            value={customExpiry}
                                            onChange={(e) => {
                                                setCustomExpiry(e.target.value);
                                                setDisplayDate(formatToDDMMYYYY(e.target.value));
                                            }}
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                        />
                                        <CalendarDays className="h-4 w-4 text-blue-600" />
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium text-gray-500 mt-1.5 block">
                                    {customExpiry ? (
                                        <span className="text-emerald-600 font-bold">
                                            Selected Expiry: {new Date(customExpiry).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })} (DD/MM/YYYY: {formatToDDMMYYYY(customExpiry)})
                                        </span>
                                    ) : (
                                        "Leave empty for plan default. Type DD/MM/YYYY or click calendar icon."
                                    )}
                                </span>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                                    Reason / Admin Notes (Optional)
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="e.g. Granted trial extensions or offline payment received"
                                    value={assignReason}
                                    onChange={(e) => setAssignReason(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 p-3 text-sm font-medium text-gray-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setModalProvider(null)}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAssignSubscription}
                                disabled={submitting || !selectedPlanId}
                                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activate Subscription"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default AdminProviderSubscriptions;
