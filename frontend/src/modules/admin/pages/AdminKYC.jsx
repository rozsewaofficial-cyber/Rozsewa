import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle, XCircle, Search, FileText, Loader2, MapPin, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminKYC = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        setTitle("KYC Verification");
        fetchKycRequests();
    }, [setTitle]);

    const fetchKycRequests = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/providers");
            // Show all for now, filter for pending in logic
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

    const filteredRequests = (providers || []).filter(p => {
        const s = (searchTerm || "").toLowerCase();
        return p.shopName?.toLowerCase().includes(s) ||
            p.ownerName?.toLowerCase().includes(s) ||
            p.vendorCode?.toLowerCase().includes(s);
    });

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">KYC Verification</h1>
                    <p className="text-sm text-gray-500 font-medium">Approve or reject vendor proof of identity.</p>
                </div>

                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by vendor name, code, or owner..."
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/50 text-[10px] uppercase font-black tracking-widest text-gray-400 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-5">Req Code</th>
                                <th className="px-6 py-5">Vendor Detail</th>
                                <th className="px-6 py-5 text-center">Identity Proofs</th>
                                <th className="px-6 py-5">Status</th>
                                <th className="px-6 py-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-gray-400 italic">No KYC requests found.</td>
                                </tr>
                            ) : filteredRequests.map(req => (
                                <tr key={req._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-700">{req.vendorCode}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <p className="font-extrabold text-gray-900 text-sm">{req.shopName}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {req.mobile}</span>
                                                <span className="flex items-center gap-1 mx-2"><MapPin className="h-3 w-3 text-emerald-500" /> {req.city || 'Indore...'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-10">
                                            {/* Aadhaar */}
                                            <div className="flex items-center gap-2.5 group/doc">
                                                <div className="flex items-center -space-x-3">
                                                    <button
                                                        onClick={() => req.kycAadhaarPhoto && setSelectedDoc({ url: req.kycAadhaarPhoto, label: 'Aadhaar Front' })}
                                                        className="h-10 w-10 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer overflow-hidden relative z-10 shadow-sm"
                                                    >
                                                        {req.kycAadhaarPhoto ? (
                                                            <img src={req.kycAadhaarPhoto} alt="Aadhaar Front" className="h-full w-full object-cover transition-transform group-hover/doc:scale-110" />
                                                        ) : (
                                                            <FileText className="h-5 w-5 text-slate-300" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => req.kycAadhaarBackPhoto && setSelectedDoc({ url: req.kycAadhaarBackPhoto, label: 'Aadhaar Back' })}
                                                        className="h-10 w-10 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer overflow-hidden relative z-0 shadow-sm"
                                                    >
                                                        {req.kycAadhaarBackPhoto ? (
                                                            <img src={req.kycAadhaarBackPhoto} alt="Aadhaar Back" className="h-full w-full object-cover transition-transform group-hover/doc:scale-110" />
                                                        ) : (
                                                            <FileText className="h-5 w-5 text-slate-300" />
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Aadhaar Card</span>
                                                    <span className="text-[11px] font-bold text-slate-900">{req.kycAadhaar || 'Not Provided'}</span>
                                                </div>
                                            </div>

                                            {/* PAN */}
                                            <div className="flex items-center gap-2.5 group/doc">
                                                <button
                                                    onClick={() => req.kycPanPhoto && setSelectedDoc({ url: req.kycPanPhoto, label: 'PAN Card' })}
                                                    className="h-10 w-10 flex-shrink-0 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer overflow-hidden"
                                                >
                                                    {req.kycPanPhoto ? (
                                                        <img src={req.kycPanPhoto} alt="PAN" className="h-full w-full object-cover transition-transform group-hover/doc:scale-110" />
                                                    ) : (
                                                        <FileText className="h-5 w-5 text-slate-300" />
                                                    )}
                                                </button>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">PAN Card</span>
                                                    <span className="text-[11px] font-bold text-slate-900">{req.kycPanNumber || 'Not Provided'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border ${req.status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {req.status === 'pending' ? (
                                            <div className="flex items-center justify-center gap-2.5">
                                                <button
                                                    onClick={() => handleAction(req._id, 'approve')}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-600/20"
                                                    title="Approve KYC"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleAction(req._id, 'reject')}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-all shadow-sm"
                                                    title="Reject KYC"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-1.5 text-gray-400">
                                                <CheckCircle className="h-3 w-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Document Preview Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{selectedDoc.label}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identity Verification Document</p>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8 flex items-center justify-center bg-slate-50">
                            <img src={selectedDoc.url} alt="KYC Document" className="max-h-[60vh] w-auto rounded-xl shadow-lg" />
                        </div>
                        <div className="p-6 text-center bg-white">
                            <button onClick={() => setSelectedDoc(null)} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest">Close View</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminKYC;
