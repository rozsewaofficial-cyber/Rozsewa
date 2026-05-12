import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { HelpCircle, FileText, Plus, BookOpen, MessageSquare, ExternalLink, PlayCircle, Trash2, X } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AdminHelpTraining = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [faqs, setFaqs] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ question: "", answer: "", category: "General" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setTitle("Help & Training");
        fetchFaqs();
    }, [setTitle]);

    const fetchFaqs = async () => {
        try {
            const { data } = await API.get("/faqs");
            setFaqs(data);
        } catch (err) {
            console.error("Failed to fetch FAQs", err);
        }
    };

    const handleCreateFaq = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await API.post("/faqs", formData);
            toast({ title: "FAQ Created" });
            setShowModal(false);
            setFormData({ question: "", answer: "", category: "General" });
            fetchFaqs();
        } catch (err) {
            toast({ title: "Error", description: err.response?.data?.message || "Failed to create", variant: "destructive" });
        }
        setLoading(false);
    };

    const handleDeleteFaq = async (id) => {
        if (window.confirm("Are you sure you want to delete this FAQ?")) {
            try {
                await API.delete(`/faqs/${id}`);
                toast({ title: "FAQ Deleted" });
                fetchFaqs();
            } catch (err) {
                toast({ title: "Error", description: err.response?.data?.message || "Failed to delete", variant: "destructive" });
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-foreground">Help & Training Console</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage vendor training guides, customer help center, and app documentation.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700 transition"><Plus className="h-4 w-4" /> Create FAQ</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-8">
                    {/* Section: Vendor Academy */}
                    <section>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1"><BookOpen className="h-4 w-4" /> Vendor Academy Content</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { title: "Onboarding for New Vendors", type: "Video Guide", time: "8m 14s", icon: PlayCircle },
                                { title: "Service Quality Standards", type: "PDF Policy", time: "4.2 MB", icon: FileText },
                                { title: "Wallet & Payout Guide", type: "Article", time: "5 min read", icon: BookOpen },
                                { title: "99 Card Benefits Explained", type: "Article", time: "3 min read", icon: BookOpen }
                            ].map((item, i) => (
                                <div key={i} className="p-5 rounded-2xl border border-border bg-white shadow-sm group hover:border-emerald-500 transition-all cursor-pointer border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{item.type}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 leading-tight mb-2 pr-4">{item.title}</h4>
                                    <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1 uppercase tracking-tight">{item.time} <ExternalLink className="h-2.5 w-2.5 ml-1" /></p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Section: Customer Support Config */}
                    <section>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1"><MessageSquare className="h-4 w-4" /> Customer App FAQ Hub</h3>
                        <div className="rounded-2xl border border-border bg-white shadow-sm divide-y divide-border border-gray-100 divide-gray-100">
                            {faqs.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">No FAQs found.</div>
                            ) : faqs.map((f) => (
                                <div key={f._id} className="p-4 flex items-center justify-between hover:bg-gray-50 text-sm font-bold text-gray-700 px-6">
                                    <div>
                                        <p className="text-gray-900">{f.question}</p>
                                        <p className="text-xs font-medium text-gray-500 mt-1">{f.answer}</p>
                                    </div>
                                    <button onClick={() => handleDeleteFaq(f._id)} className="text-rose-500 hover:text-rose-700 transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm border-gray-100">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Support Health</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                    <span className="font-bold text-gray-600">Pending Tickets</span>
                                    <span className="font-black text-amber-600">12</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500" style={{ width: '40%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                    <span className="font-bold text-gray-600">Article Satisfaction</span>
                                    <span className="font-black text-emerald-600">92%</span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: '92%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 p-6 text-white text-center shadow-lg shadow-blue-200">
                        <div className="h-14 w-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-sm">
                            <MessageSquare className="h-7 w-7" />
                        </div>
                        <h4 className="font-black text-lg">Support Integration</h4>
                        <p className="text-xs text-blue-100/80 mt-2 mb-6 leading-relaxed">Your Intercom/Zendesk live chat ID is currently active and pulling data.</p>
                        <button className="w-full py-3 bg-white text-blue-800 rounded-xl font-black text-xs hover:bg-blue-50 transition shadow-md">Open Chat Console</button>
                    </div>
                </div>
            </div>

            {/* Modal for Create FAQ */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-foreground">Create New FAQ</h3>
                            <button onClick={() => setShowModal(false)}><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleCreateFaq} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600">Question</label>
                                <input type="text" required value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">Answer</label>
                                <textarea required value={formData.answer} onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full h-24 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm focus:border-emerald-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">Category</label>
                                <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition">
                                {loading ? "Creating..." : "Create FAQ"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHelpTraining;
