import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle, XCircle, Search, FileText, Loader2, MapPin, Phone, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import API from "@/lib/api";

const AdminVerifyEmployee = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        setTitle("Verify Employee KYC");
        fetchPendingEmployees();
    }, [setTitle]);

    const fetchPendingEmployees = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/employees?status=pending");
            setEmployees(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id) => {
        try {
            await API.put(`/admin/employees/${id}/verify`);
            setEmployees(prev => prev.filter(e => e._id !== id));
            toast({ title: "Employee Verified", description: "Employee identity approved successfully." });
        } catch (err) {
            toast({ title: "Verification Failed", variant: "destructive" });
        }
    };

    const handleReject = async (id) => {
        try {
            await API.put(`/admin/employees/${id}/reject`);
            setEmployees(prev => prev.filter(e => e._id !== id));
            toast({ title: "Employee Rejected", description: "Employee verification rejected." });
        } catch (err) {
            toast({ title: "Action Failed", variant: "destructive" });
        }
    };

    const filteredEmployees = (employees || []).filter(e => {
        const query = (searchTerm || "").toLowerCase();
        return e.name?.toLowerCase().includes(query) ||
            e.employeeId?.toLowerCase().includes(query) ||
            e.mobile?.toLowerCase().includes(query);
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
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Employee Verification</h1>
                    <p className="text-sm text-gray-500 font-medium">Approve KYC documents for newly registered employees.</p>
                </div>

                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, code, or mobile..."
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredEmployees.length === 0 ? (
                    <div className="py-20 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="h-8 w-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900">All caught up!</h3>
                        <p className="text-gray-500 text-sm">No pending employee verification requests at the moment.</p>
                    </div>
                ) : (
                    filteredEmployees.map(emp => (
                        <div key={emp._id} className="bg-white rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col md:flex-row gap-6 items-center">
                            {/* Profile Info */}
                            <div className="flex items-center gap-4 min-w-[200px] shrink-0">
                                <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-lg font-black text-emerald-600 shrink-0">
                                    {emp.name?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-gray-900 truncate leading-tight">{emp.name}</h3>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{emp.employeeId || emp.ownCode}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            <Phone className="h-2.5 w-2.5 text-emerald-500" /> {emp.mobile}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            <FileText className="h-2.5 w-2.5 text-emerald-500" /> {emp.role}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Documents */}
                            <div className="flex-1 flex flex-row flex-wrap gap-3 w-full border-x md:px-6 border-gray-50">
                                {emp.panCardPhoto && (
                                    <div className="group flex items-center gap-3 bg-gray-50/50 hover:bg-emerald-50 rounded-xl p-2 pr-3 border border-gray-100 transition-colors cursor-pointer" onClick={() => setSelectedDoc({ url: emp.panCardPhoto, label: "PAN Card" })}>
                                        <div className="h-10 w-12 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                            <img src={emp.panCardPhoto} alt="PAN Card" className="h-full w-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-tight leading-none mb-1">PAN Card</p>
                                            <div className="flex items-center gap-1">
                                                <Eye className="h-2.5 w-2.5 text-emerald-500" />
                                                <span className="text-[8px] font-black text-emerald-600/60 uppercase">View</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {emp.aadharCardPhoto && (
                                    <div className="group flex items-center gap-3 bg-gray-50/50 hover:bg-emerald-50 rounded-xl p-2 pr-3 border border-gray-100 transition-colors cursor-pointer" onClick={() => setSelectedDoc({ url: emp.aadharCardPhoto, label: "Aadhaar Card" })}>
                                        <div className="h-10 w-12 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                            <img src={emp.aadharCardPhoto} alt="Aadhaar Card" className="h-full w-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-tight leading-none mb-1">Aadhaar Card</p>
                                            <div className="flex items-center gap-1">
                                                <Eye className="h-2.5 w-2.5 text-emerald-500" />
                                                <span className="text-[8px] font-black text-emerald-600/60 uppercase">View</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!emp.panCardPhoto && !emp.aadharCardPhoto && (
                                    <p className="text-xs text-gray-400 italic">No documents uploaded</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                                <Button
                                    variant="outline"
                                    onClick={() => handleReject(emp._id)}
                                    className="flex-1 md:flex-none border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 font-bold h-10 px-4 rounded-xl text-xs"
                                >
                                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                    REJECT
                                </Button>
                                <Button
                                    onClick={() => handleVerify(emp._id)}
                                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 px-6 rounded-xl shadow-sm text-xs"
                                >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                    APPROVE
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
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Document</p>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-8 flex items-center justify-center bg-slate-50">
                            <img src={selectedDoc.url} alt="Document" className="max-h-[60vh] w-auto rounded-xl shadow-lg" />
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

export default AdminVerifyEmployee;
