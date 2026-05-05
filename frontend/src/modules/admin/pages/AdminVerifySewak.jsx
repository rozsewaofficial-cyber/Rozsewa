import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle, XCircle, Search, FileText, Loader2, MapPin, Phone, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import API from "@/lib/api";

const AdminVerifySewak = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [sewaks, setSewaks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        setTitle("Verify Sewak KYC");
        fetchPendingSewaks();
    }, [setTitle]);

    const fetchPendingSewaks = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/sewaks/pending-kyc");
            setSewaks(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id) => {
        try {
            await API.put(`/admin/sewaks/${id}/verify`);
            setSewaks(prev => prev.filter(s => s._id !== id));
            toast({ title: "Sewak Verified", description: "Identity KYC approved successfully." });
        } catch (err) {
            toast({ title: "Verification Failed", variant: "destructive" });
        }
    };

    const handleReject = async (id) => {
        try {
            await API.put(`/admin/sewaks/${id}/reject`);
            setSewaks(prev => prev.filter(s => s._id !== id));
            toast({ title: "Sewak Rejected", description: "KYC documents have been rejected." });
        } catch (err) {
            toast({ title: "Action Failed", variant: "destructive" });
        }
    };

    const filteredSewaks = (sewaks || []).filter(s => {
        const query = (searchTerm || "").toLowerCase();
        return s.ownerName?.toLowerCase().includes(query) ||
            s.vendorCode?.toLowerCase().includes(query) ||
            s.mobile?.toLowerCase().includes(query);
    });

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Sewak Verification</h1>
                    <p className="text-sm text-gray-500 font-medium">Approve KYC documents for newly registered Sewaks.</p>
                </div>

                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, code, or mobile..."
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredSewaks.length === 0 ? (
                    <div className="py-20 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900">All caught up!</h3>
                        <p className="text-gray-500 text-sm">No pending Sewak KYC requests at the moment.</p>
                    </div>
                ) : (
                    filteredSewaks.map(sewak => (
                        <div key={sewak._id} className="bg-white rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col md:flex-row gap-6 items-center">
                            {/* Profile Info - More Compact */}
                            <div className="flex items-center gap-4 min-w-[200px] shrink-0">
                                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-lg font-black text-blue-600 shrink-0">
                                    {sewak.ownerName?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-gray-900 truncate leading-tight">{sewak.ownerName}</h3>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{sewak.vendorCode}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            <Phone className="h-2.5 w-2.5 text-blue-500" /> {sewak.mobile}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            <MapPin className="h-2.5 w-2.5 text-blue-500" /> {sewak.city}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Documents - Smaller Row Layout */}
                            <div className="flex-1 flex flex-row flex-wrap gap-3 w-full border-x md:px-6 border-gray-50">
                                {sewak.documents?.map(doc => (
                                    <div key={doc.id} className="group flex items-center gap-3 bg-gray-50/50 hover:bg-blue-50 rounded-xl p-2 pr-3 border border-gray-100 transition-colors cursor-pointer" onClick={() => setSelectedDoc({ url: doc.url, label: doc.id.toUpperCase() })}>
                                        <div className="h-10 w-12 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                            <img src={doc.url} alt={doc.id} className="h-full w-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-tight leading-none mb-1">{doc.id.replace('_', ' ')}</p>
                                            <div className="flex items-center gap-1">
                                                <Eye className="h-2.5 w-2.5 text-blue-500" />
                                                <span className="text-[8px] font-black text-blue-600/60 uppercase">View</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!sewak.documents || sewak.documents.length === 0) && (
                                    <p className="text-xs text-gray-400 italic">No documents uploaded</p>
                                )}
                            </div>

                            {/* Actions - Horizontal & Professional */}
                            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                                <Button
                                    variant="outline"
                                    onClick={() => handleReject(sewak._id)}
                                    className="flex-1 md:flex-none border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 font-bold h-10 px-4 rounded-xl text-xs"
                                >
                                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                    REJECT
                                </Button>
                                <Button
                                    onClick={() => handleVerify(sewak._id)}
                                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 px-6 rounded-xl shadow-sm text-xs"
                                >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                    APPROVE KYC
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Document Preview Modal */}
            {selectedDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{selectedDoc.label}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sewak Identity Document</p>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8 flex items-center justify-center bg-slate-50">
                            <img src={selectedDoc.url} alt="KYC Document" className="max-h-[60vh] w-auto rounded-xl shadow-lg" />
                        </div>
                        <div className="p-6 text-center bg-white">
                            <Button onClick={() => setSelectedDoc(null)} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest h-12">Close Preview</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminVerifySewak;
