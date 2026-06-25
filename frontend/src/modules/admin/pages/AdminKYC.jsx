import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle, XCircle, Search, FileText, Loader2,
    MapPin, Phone, MoreVertical, X, CreditCard,
    Camera, ShieldCheck, Users, Clock, ShieldAlert,
    CheckCircle2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const STATUS_CONFIG = {
    verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border border-red-200" },
};

const AdminKYC = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(null);

    useScrollLock(!!selectedDoc || !!selectedProvider);

    useEffect(() => {
        setTitle("KYC Verification");
        fetchKycRequests();
    }, [setTitle]);

    const fetchKycRequests = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/providers");
            setProviders(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, action) => {
        const newStatus = action === 'approve' ? 'verified' : 'rejected';
        try {
            await API.put(`/admin/providers/${id}/status`, { status: newStatus });
            setProviders(prev => prev.map(p => p._id === id ? { ...p, status: newStatus } : p));
            toast({ title: `KYC ${action === 'approve' ? 'Approved' : 'Rejected'}`, description: `Provider account status updated.` });
        } catch (err) {
            toast({ title: "Action Failed", variant: "destructive" });
        }
    };

    // Stats
    const stats = useMemo(() => ({
        total: providers.length,
        pending: providers.filter(p => p.status === 'pending').length,
        verified: providers.filter(p => p.status === 'verified').length,
        rejected: providers.filter(p => p.status === 'rejected').length,
    }), [providers]);

    const filteredRequests = providers.filter(p => {
        const searchMatch = (searchTerm === "") ||
            p.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.vendorCode?.toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = statusFilter === 'all' || p.status === statusFilter;
        return searchMatch && statusMatch;
    });

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">KYC Verification</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">{stats.pending} pending requests requiring action</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Providers", value: stats.total, icon: Users, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Pending KYC", value: stats.pending, icon: Clock, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Verified", value: stats.verified, icon: ShieldCheck, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Rejected", value: stats.rejected, icon: ShieldAlert, cls: "text-red-700 bg-red-50 border-red-200" },
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
            <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { key: "all", label: "All", count: stats.total },
                        { key: "pending", label: "Pending", count: stats.pending },
                        { key: "verified", label: "Verified", count: stats.verified },
                        { key: "rejected", label: "Rejected", count: stats.rejected },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                statusFilter === f.key ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                        >
                            {f.label}
                            <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-black ${statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {f.count}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
                        placeholder="Search vendor, code, owner..."
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                <th className="py-4 px-5">Req Code</th>
                                <th className="py-4 px-5">Vendor Detail</th>
                                <th className="py-4 px-5 text-center">Identity Proofs</th>
                                <th className="py-4 px-5 text-center">Status</th>
                                <th className="py-4 px-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                                        <p className="text-sm text-gray-400 mt-3 font-medium">Loading KYC requests...</p>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <ShieldCheck className="h-10 w-10 text-gray-200 mx-auto" />
                                        <p className="text-sm text-gray-400 mt-3 font-bold">No requests found</p>
                                        <p className="text-xs text-gray-300 mt-1">Try adjusting your search or filter</p>
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence>
                                    {filteredRequests.map((req, idx) => {
                                        const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                                        return (
                                            <motion.tr
                                                key={req._id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className="hover:bg-gray-50/80 transition-colors group"
                                            >
                                                {/* Req Code */}
                                                <td className="py-3.5 px-5">
                                                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                        {req.vendorCode}
                                                    </span>
                                                </td>

                                                {/* Vendor Detail */}
                                                <td className="py-3.5 px-5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="font-bold text-gray-900 text-sm">{req.shopName}</p>
                                                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">
                                                            <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-gray-400" /> {req.mobile}</span>
                                                            <span className="flex items-center gap-1 mx-2"><MapPin className="h-3 w-3 text-emerald-500" /> {req.city || 'Indore...'}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Identity Proofs */}
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center justify-center gap-8">
                                                        {/* Aadhaar */}
                                                        <div className="flex items-center gap-2.5 group/doc">
                                                            <div className="flex items-center -space-x-3">
                                                                <button
                                                                    onClick={() => req.kycAadhaarPhoto && setSelectedDoc({ url: req.kycAadhaarPhoto, label: 'Aadhaar Front' })}
                                                                    className="h-9 w-9 flex-shrink-0 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer overflow-hidden relative z-10 shadow-sm"
                                                                >
                                                                    {req.kycAadhaarPhoto ? (
                                                                        <img src={req.kycAadhaarPhoto} alt="Aadhaar Front" className="h-full w-full object-cover transition-transform group-hover/doc:scale-110" />
                                                                    ) : (
                                                                        <FileText className="h-4 w-4 text-gray-300" />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => req.kycAadhaarBackPhoto && setSelectedDoc({ url: req.kycAadhaarBackPhoto, label: 'Aadhaar Back' })}
                                                                    className="h-9 w-9 flex-shrink-0 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer overflow-hidden relative z-0 shadow-sm"
                                                                >
                                                                    {req.kycAadhaarBackPhoto ? (
                                                                        <img src={req.kycAadhaarBackPhoto} alt="Aadhaar Back" className="h-full w-full object-cover transition-transform group-hover/doc:scale-110" />
                                                                    ) : (
                                                                        <FileText className="h-4 w-4 text-gray-300" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">Aadhaar Card</span>
                                                                <span className="text-[10px] font-bold text-gray-900">{req.kycAadhaar || 'Not Provided'}</span>
                                                            </div>
                                                        </div>

                                                        {/* PAN */}
                                                        <div className="flex items-center gap-2.5 group/doc">
                                                            <button
                                                                onClick={() => req.kycPanPhoto && setSelectedDoc({ url: req.kycPanPhoto, label: 'PAN Card' })}
                                                                className="h-9 w-9 flex-shrink-0 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer overflow-hidden shadow-sm"
                                                            >
                                                                {req.kycPanPhoto ? (
                                                                    <img src={req.kycPanPhoto} alt="PAN" className="h-full w-full object-cover transition-transform group-hover/doc:scale-110" />
                                                                ) : (
                                                                    <FileText className="h-4 w-4 text-gray-300" />
                                                                )}
                                                            </button>
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-[9px] font-black uppercase text-gray-400 tracking-tighter">PAN Card</span>
                                                                <span className="text-[10px] font-bold text-gray-900">{req.kycPanNumber || 'Not Provided'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="py-3.5 px-5 text-center">
                                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${sc.cls}`}>
                                                        {sc.label}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {req.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAction(req._id, 'approve')}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                                                    title="Approve KYC"
                                                                >
                                                                    <CheckCircle2 className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAction(req._id, 'reject')}
                                                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                                                    title="Reject KYC"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedProvider(req)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-200 transition-all"
                                                            title="View Details"
                                                        >
                                                            <MoreVertical className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer */}
                {filteredRequests.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Showing {filteredRequests.length} of {providers.length} requests</p>
                    </div>
                )}
            </div>

            {/* Document Preview Modal */}
            <AnimatePresence>
                {selectedDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    >
                        <div className="absolute inset-0" onClick={() => setSelectedDoc(null)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">{selectedDoc.label}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Identity Verification Document</p>
                                </div>
                                <button onClick={() => setSelectedDoc(null)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="p-8 flex items-center justify-center bg-gray-50/50">
                                <img src={selectedDoc.url} alt="KYC Document" className="max-h-[60vh] w-auto rounded-xl shadow-lg border border-gray-200" />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Provider Details Modal */}
            <AnimatePresence>
                {selectedProvider && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                        onClick={() => setSelectedProvider(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl custom-scrollbar"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">Provider Details</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">ID: {selectedProvider.vendorCode}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedProvider(null)}
                                    className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-6 space-y-8 bg-gray-50/30">
                                {/* Profile & Business Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                            <FileText className="h-3.5 w-3.5" /> Profile Info
                                        </h4>
                                        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3.5 text-sm shadow-sm">
                                            <div className="flex justify-between border-b border-gray-100 pb-2.5"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Owner Name</span><span className="font-black text-gray-900">{selectedProvider.ownerName}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-2.5"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Business Name</span><span className="font-black text-gray-900">{selectedProvider.shopName}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-2.5"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Mobile</span><span className="font-black text-gray-900">{selectedProvider.mobile}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Email</span><span className="font-black text-gray-900">{selectedProvider.email || 'N/A'}</span></div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600">
                                            <ShieldCheck className="h-3.5 w-3.5" /> Business & KYC
                                        </h4>
                                        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3.5 text-sm shadow-sm">
                                            <div className="flex justify-between border-b border-gray-100 pb-2.5"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Category / Role</span><span className="font-black text-gray-900 capitalize">{selectedProvider.providerCategory}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-2.5"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Aadhaar No</span><span className="font-black text-gray-900 font-mono tracking-wider">{selectedProvider.kycAadhaar || 'N/A'}</span></div>
                                            <div className="flex justify-between border-b border-gray-100 pb-2.5"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">PAN No</span><span className="font-black text-gray-900 font-mono tracking-wider">{selectedProvider.kycPanNumber || 'N/A'}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500 font-bold text-xs uppercase tracking-wider">GST Number</span><span className="font-black text-gray-900 font-mono tracking-wider">{selectedProvider.gst || 'N/A'}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Details */}
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-600">
                                        <CreditCard className="h-3.5 w-3.5" /> Bank Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-xl border border-purple-100 bg-purple-50/50 p-5 text-sm">
                                        <div className="space-y-1"><span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider block">Account Holder</span><span className="font-black text-purple-900">{selectedProvider.bankDetails?.accountHolderName || 'N/A'}</span></div>
                                        <div className="space-y-1"><span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider block">Account Number</span><span className="font-black text-purple-900 font-mono">{selectedProvider.bankDetails?.accountNumber || 'N/A'}</span></div>
                                        <div className="space-y-1"><span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider block">IFSC Code</span><span className="font-black text-purple-900 font-mono">{selectedProvider.bankDetails?.ifscCode || 'N/A'}</span></div>
                                        <div className="space-y-1"><span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider block">Bank Name</span><span className="font-black text-purple-900">{selectedProvider.bankDetails?.bankName || 'N/A'}</span></div>
                                    </div>
                                </div>

                                {/* Documents / Images */}
                                <div className="space-y-3">
                                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-600">
                                        <Camera className="h-3.5 w-3.5" /> Identity Documents
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: "Profile Photo", url: selectedProvider.profileImage },
                                            { label: "Aadhaar Front", url: selectedProvider.kycAadhaarPhoto },
                                            { label: "Aadhaar Back", url: selectedProvider.kycAadhaarBackPhoto },
                                            { label: "PAN Card", url: selectedProvider.kycPanPhoto }
                                        ].map((doc, idx) => (
                                            <div key={idx} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-2.5 bg-white shadow-sm">
                                                <span className="text-[10px] font-black text-gray-400 text-center uppercase tracking-widest">{doc.label}</span>
                                                {doc.url ? (
                                                    <a href={doc.url} target="_blank" rel="noreferrer" className="block h-32 rounded-lg overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity bg-gray-50 relative group">
                                                        <img src={doc.url} alt={doc.label} className="h-full w-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Search className="h-6 w-6 text-white" />
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <div className="flex h-32 items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-200">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Not Uploaded</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminKYC;
