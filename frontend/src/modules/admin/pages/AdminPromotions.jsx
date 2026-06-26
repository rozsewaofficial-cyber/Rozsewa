import { useEffect, useState } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { Database, Terminal, ShieldAlert, Cpu, HardDrive, RefreshCcw, Tag, Megaphone, Trash2, Plus, XCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AdminPromotions = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();

    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newPromo, setNewPromo] = useState({ title: "", promoCode: "", description: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useScrollLock(showModal);

    useEffect(() => {
        setTitle("Global Promotions");
        fetchPromotions();
    }, [setTitle]);

    const fetchPromotions = async () => {
        try {
            setLoading(true);
            const { data } = await API.get("/admin/promotions");
            setPromotions(data);
        } catch (error) {
            console.error("Error fetching promotions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePromo = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await API.post("/admin/promotions", newPromo);
            toast({ title: "Success", description: "Promotion created successfully!" });
            setNewPromo({ title: "", promoCode: "", description: "" });
            setShowModal(false);
            fetchPromotions();
        } catch (error) {
            toast({ title: "Error", description: error.response?.data?.message || "Failed to create promotion.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this promotion?")) return;
        try {
            await API.delete(`/admin/promotions/${id}`);
            toast({ title: "Deleted", description: "Promotion removed." });
            setPromotions(prev => prev.filter(p => p._id !== id));
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete promotion.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Global Promotions</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage platform-wide marketing campaigns and promo codes.</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md flex items-center gap-2 transition-all hover:bg-emerald-700 active:scale-95"><Cpu className="h-3.5 w-3.5" /> Optimized Cache</button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold border border-border flex items-center gap-2 border-gray-100 transition-all hover:bg-gray-200 active:scale-95"><RefreshCcw className="h-3.5 w-3.5" /> Restart Dispatcher</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden border-gray-100">
                        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-2 border-gray-100">
                            <Database className="h-4 w-4 text-emerald-600" />
                            <h3 className="font-black text-xs uppercase tracking-widest text-foreground">Global Pricing Constants</h3>
                        </div>
                        <div className="p-0 divide-y divide-border divide-gray-100">
                            {[
                                { key: "Base Commission %", val: "10.00", unit: "%", desc: "Default cut on all service bookings." },
                                { key: "Emergency Prem. %", val: "15.00", unit: "%", desc: "Extra charge for late-night jobs." },
                                { key: "Referral Bonus Jobs", val: "3", unit: "Orders", desc: "Free jobs per 99 Card referral." },
                                { key: "Platform Fee (User)", val: "₹19.00", unit: "per job", desc: "Fixed convenience charge for apps." }
                            ].map((row, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 flex-wrap sm:flex-nowrap gap-4 group">
                                    <div className="w-full sm:w-auto">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1.5">{row.key}</p>
                                        <p className="text-xs text-muted-foreground mr-8 leading-relaxed mb-3 sm:mb-0">{row.desc}</p>
                                    </div>
                                    <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                                        <div className="text-right">
                                            <span className="text-lg font-black text-foreground">{row.val}</span>
                                            <span className="text-[10px] font-bold text-gray-400 ml-1 uppercase">{row.unit}</span>
                                        </div>
                                        <button className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-bold hover:border-emerald-500 hover:text-emerald-700 transition shadow-sm opacity-0 group-hover:opacity-100 border-gray-100">EDIT</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden border-gray-100">

                        <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-2 border-gray-100">
                            <Megaphone className="h-4 w-4 text-blue-600" />
                            <h3 className="font-black text-xs uppercase tracking-widest text-foreground">Ongoing Platform Promotions</h3>
                        </div>
                        <div className="p-0 divide-y divide-border divide-gray-100 min-h-[100px]">
                            {loading ? (
                                <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                            ) : promotions.length === 0 ? (
                                <div className="p-12 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">No Active Campaigns</div>
                            ) : promotions.map((p) => (
                                <div key={p._id} className="p-4 flex items-center justify-between hover:bg-gray-50 group transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Tag className="h-5 w-5" /></div>
                                        <div>
                                            <h4 className="font-bold text-sm text-gray-900 leading-tight">{p.title}</h4>
                                            <p className="text-[10px] font-black text-blue-600 uppercase mt-1 tracking-widest">{p.promoCode}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-6">
                                        <div className="hidden sm:block">
                                            <p className="text-xs font-bold text-gray-900">{p.activeUsers || 0}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Activated</p>
                                        </div>
                                        <div className="hidden sm:block text-right min-w-[60px]">
                                            <p className="text-xs font-bold text-emerald-600">₹{p.spend || 0}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Spend</p>
                                        </div>
                                        <Trash2
                                            onClick={() => handleDelete(p._id)}
                                            className="h-4.5 w-4.5 text-gray-300 hover:text-red-600 cursor-pointer transition opacity-0 group-hover:opacity-100"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full py-4 text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 hover:bg-blue-100 transition border-t border-border border-gray-100 active:bg-blue-200"
                        >
                            + New Global Campaign
                        </button>
                    </section>
                </div>

                <aside className="space-y-6">
                    <div className="rounded-2xl border-2 border-red-100 bg-red-50 p-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12"><ShieldAlert className="h-16 w-16 text-red-600" /></div>
                        <h3 className="text-sm font-black text-red-900 uppercase tracking-widest mb-4 flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Risk Monitor</h3>
                        <div className="space-y-3 relative z-10">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-700">Fraud Flag Pattern</span>
                                <span className="font-black text-red-600 bg-white px-2 py-0.5 rounded shadow-sm border border-red-100 uppercase tracking-tighter">Normal</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-700">Abuse Logins (2h)</span>
                                <span className="font-black text-gray-900">04</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-700">Server Latency</span>
                                <span className="font-black text-emerald-600">42ms</span>
                            </div>
                        </div>
                        <button className="mt-6 w-full py-3 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition">Access Security Vault</button>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><HardDrive className="h-4 w-4" /> System Health</h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-gray-700">Booking Engine 1.2a ONLINE</span>
                            </div>
                            <div className="flex items-center gap-3 opacity-60">
                                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                <span className="text-xs font-bold text-gray-700">Worker Node Delhi#3 ONLINE</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                <span className="text-xs font-bold text-gray-700">OTP Gateway IDLE</span>
                            </div>
                        </div>
                        <button className="mt-8 text-xs font-bold text-blue-600 uppercase flex items-center gap-2 hover:underline"><Terminal className="h-4 w-4" /> Open Cloud Console</button>
                    </div>
                </aside>
            </div>

            {/* Campaign Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
                        >
                            <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                                <h3 className="text-xl font-black tracking-tight flex items-center gap-2"><Megaphone className="h-5 w-5" /> New Campaign</h3>
                                <XCircle className="h-6 w-6 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setShowModal(false)} />
                            </div>
                            <form onSubmit={handleCreatePromo} className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Campaign Title</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-sm"
                                        placeholder="e.g. Diwali 2026 Home Blast"
                                        value={newPromo.title}
                                        onChange={e => setNewPromo({ ...newPromo, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Promo Code</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-black text-sm uppercase"
                                        placeholder="e.g. SHUBH100"
                                        value={newPromo.promoCode}
                                        onChange={e => setNewPromo({ ...newPromo, promoCode: e.target.value })}
                                    />
                                </div>
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex justify-center items-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish Campaign"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminPromotions;
