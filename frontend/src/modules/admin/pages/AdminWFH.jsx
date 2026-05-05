import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck, Search, Loader2, CheckCircle2, XCircle, 
    Eye, MapPin, Phone, Mail, Calendar, User, ExternalLink
} from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AdminWFH = () => {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchPendingVendors();
    }, []);

    const fetchPendingVendors = async () => {
        try {
            const { data } = await API.get("/wfh/pending-vendors");
            setVendors(data);
        } catch (err) {
            toast({ title: "Failed to fetch vendors", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id) => {
        setVerifying(true);
        try {
            await API.put(`/wfh/verify-vendor/${id}`);
            toast({ title: "Vendor verified successfully!" });
            setVendors(vendors.filter(v => v._id !== id));
            setSelectedVendor(null);
        } catch (err) {
            toast({ title: "Verification failed", variant: "destructive" });
        } finally {
            setVerifying(false);
        }
    };

    const filtered = vendors.filter(v =>
        v.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        v.shopName.toLowerCase().includes(search.toLowerCase()) ||
        v.mobile.includes(search)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight italic">WFH Verification</h1>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Review and approve vendor registrations</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-2xl text-xs font-black uppercase">
                        Pending: {vendors.length}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List Section */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, shop or mobile..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-gray-100 bg-white py-3.5 pl-11 pr-4 text-sm font-bold focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-gray-100">
                                <ShieldCheck className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                                <p className="text-gray-400 font-bold italic uppercase tracking-widest text-xs">No pending verifications</p>
                            </div>
                        ) : filtered.map((vendor) => (
                            <motion.div
                                layoutId={vendor._id}
                                key={vendor._id}
                                onClick={() => setSelectedVendor(vendor)}
                                className={`p-4 rounded-3xl border transition-all cursor-pointer group ${
                                    selectedVendor?._id === vendor._id 
                                    ? "bg-blue-600 border-blue-600 shadow-xl shadow-blue-600/20" 
                                    : "bg-white border-gray-100 hover:border-blue-200 hover:shadow-md"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                                            selectedVendor?._id === vendor._id ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                                        }`}>
                                            {vendor.ownerName.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className={`font-black uppercase tracking-tight ${selectedVendor?._id === vendor._id ? "text-white" : "text-gray-900"}`}>
                                                {vendor.shopName}
                                            </h4>
                                            <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${selectedVendor?._id === vendor._id ? "text-blue-100" : "text-gray-400"}`}>
                                                <User className="h-3 w-3" /> {vendor.ownerName}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={`text-[10px] font-black uppercase tracking-widest ${selectedVendor?._id === vendor._id ? "text-blue-200" : "text-gray-400"}`}>
                                            {new Date(vendor.createdAt).toLocaleDateString()}
                                        </div>
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                            selectedVendor?._id === vendor._id ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600"
                                        }`}>
                                            Pending
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Detail Section */}
                <div className="lg:col-span-1">
                    <AnimatePresence mode="wait">
                        {selectedVendor ? (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="bg-white rounded-[2.5rem] border border-gray-100 p-6 shadow-sm sticky top-6"
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-16 w-16 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 text-2xl font-black">
                                        {selectedVendor.ownerName.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">{selectedVendor.shopName}</h3>
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{selectedVendor.vendorCode}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 rounded-2xl bg-gray-50 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Phone className="h-4 w-4 text-gray-400" />
                                            <span className="text-sm font-bold text-gray-700">{selectedVendor.mobile}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-4 w-4 text-gray-400" />
                                            <span className="text-sm font-bold text-gray-700">{selectedVendor.email || "No email"}</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                                            <span className="text-sm font-bold text-gray-700 leading-tight">{selectedVendor.address}, {selectedVendor.city}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 ml-1 italic">Onboarding Info</h5>
                                        <div className="flex items-center justify-between p-3 rounded-2xl border border-gray-50 bg-gray-50/50">
                                            <span className="text-[10px] font-black uppercase text-gray-500">Field Staff Code</span>
                                            <span className="text-xs font-black text-blue-600">{selectedVendor.onboardedByStaff || "N/A"}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 ml-1 italic">Verification Actions</h5>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => handleVerify(selectedVendor._id)}
                                                disabled={verifying}
                                                className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all group"
                                            >
                                                {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 group-hover:scale-110 transition-transform" />}
                                                <span className="text-[10px] font-black uppercase tracking-widest">Verify Vendor</span>
                                            </button>
                                            <button 
                                                onClick={() => setSelectedVendor(null)}
                                                className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-red-50 text-red-600 hover:bg-red-100 transition-all group"
                                            >
                                                <XCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Reject / Skip</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white text-center shadow-2xl shadow-blue-600/30">
                                <div className="h-16 w-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <ShieldCheck className="h-8 w-8 text-white" />
                                </div>
                                <h3 className="text-xl font-black uppercase mb-3">Ready to Verify</h3>
                                <p className="text-blue-100 text-xs font-bold leading-relaxed mb-6 uppercase tracking-wider">
                                    Select a vendor from the list to review their details and complete the verification process.
                                </p>
                                <div className="h-1 w-12 bg-white/30 mx-auto rounded-full" />
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default AdminWFH;
