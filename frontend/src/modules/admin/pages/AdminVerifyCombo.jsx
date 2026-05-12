import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle, XCircle, Search, FileText, Loader2, Tag, ShoppingBag, Eye, Phone, MapPin } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import API from "@/lib/api";

const AdminVerifyCombo = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [combos, setCombos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("pending");

    useEffect(() => {
        setTitle("Verify Partner Combos");
        fetchCombos();
    }, [setTitle]);

    const fetchCombos = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/combos");
            setCombos(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id) => {
        try {
            await API.put(`/admin/combos/${id}/verify`);
            setCombos(prev => prev.map(c => c._id === id ? { ...c, status: 'approved' } : c));
            toast({ title: "Combo Approved", description: "Combo offer has been approved successfully." });
        } catch (err) {
            toast({ title: "Verification Failed", variant: "destructive" });
        }
    };

    const handleReject = async (id) => {
        try {
            await API.put(`/admin/combos/${id}/reject`);
            setCombos(prev => prev.map(c => c._id === id ? { ...c, status: 'rejected' } : c));
            toast({ title: "Combo Rejected", description: "Combo offer has been rejected." });
        } catch (err) {
            toast({ title: "Action Failed", variant: "destructive" });
        }
    };

    const filteredCombos = (combos || []).filter(c => {
        const query = (searchTerm || "").toLowerCase();
        const matchesQuery = c.name?.toLowerCase().includes(query) ||
            c.providerId?.shopName?.toLowerCase().includes(query) ||
            c.price?.toString().includes(query);
        const matchesTab = c.status === activeTab;
        return matchesQuery && matchesTab;
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
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Combo Verification</h1>
                    <p className="text-sm text-gray-500 font-medium">Approve or reject combo offers created by partners.</p>
                </div>

                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by combo name, partner..."
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-100 mb-4">
                {['pending', 'approved', 'rejected'].map(status => (
                    <button
                        key={status}
                        onClick={() => setActiveTab(status)}
                        className={`text-sm font-bold pb-2 px-1 capitalize transition-all ${
                            activeTab === status
                                ? "border-b-2 border-blue-600 text-blue-600"
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredCombos.length === 0 ? (
                    <div className="py-20 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShoppingBag className="h-8 w-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900">No combos found</h3>
                        <p className="text-gray-500 text-sm">No combo requests in this category.</p>
                    </div>
                ) : (
                    filteredCombos.map(combo => (
                        <div key={combo._id} className="bg-white rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col md:flex-row gap-6 items-center">
                            {/* Combo Info */}
                            <div className="flex items-center gap-4 min-w-[250px] shrink-0">
                                <div className="h-12 w-12 bg-purple-50 rounded-xl flex items-center justify-center text-lg font-black text-purple-600 shrink-0">
                                    {combo.image ? (
                                        <img src={combo.image} alt={combo.name} className="h-full w-full object-cover rounded-xl" />
                                    ) : (
                                        <Tag className="h-6 w-6" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-gray-900 truncate leading-tight">{combo.name}</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">By {combo.providerId?.shopName || 'Unknown Partner'}</p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Owner: {combo.providerId?.ownerName}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                                            ₹{combo.price}
                                        </span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                            combo.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                                            combo.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                                            'bg-amber-50 text-amber-700'
                                        }`}>
                                            {combo.status || 'Pending'}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            <Phone className="h-2.5 w-2.5 text-blue-500" /> {combo.providerId?.mobile}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            <MapPin className="h-2.5 w-2.5 text-blue-500" /> {combo.providerId?.city}
                                        </span>
                                        <span className="flex items-center gap-1 text-[9px] font-black text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">
                                            Code: {combo.providerId?.vendorCode}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Services Included */}
                            <div className="flex-1 flex flex-col gap-1 w-full border-x md:px-6 border-gray-50">
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Included Services:</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {combo.services?.map(service => (
                                        <span key={service._id} className="text-[9px] font-black text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 uppercase">
                                            {service.name}
                                        </span>
                                    ))}
                                    {(!combo.services || combo.services.length === 0) && (
                                        <p className="text-xs text-gray-400 italic">No services listed</p>
                                    )}
                                </div>
                                {combo.description && (
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{combo.description}</p>
                                )}
                            </div>

                            {/* Actions */}
                            {combo.status === 'pending' && (
                                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleReject(combo._id)}
                                        className="flex-1 md:flex-none border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 font-bold h-10 px-4 rounded-xl text-xs"
                                    >
                                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                        REJECT
                                    </Button>
                                    <Button
                                        onClick={() => handleVerify(combo._id)}
                                        className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 px-6 rounded-xl shadow-sm text-xs"
                                    >
                                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                                        APPROVE
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AdminVerifyCombo;
