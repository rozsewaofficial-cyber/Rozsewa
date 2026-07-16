import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext, useNavigate } from "react-router-dom";
import { HelpCircle, FileText, Plus, BookOpen, MessageSquare, ExternalLink, PlayCircle, Trash2, X } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AdminHelpTraining = () => {
    const { setTitle } = useOutletContext();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [faqs, setFaqs] = useState([]);
    const [guides, setGuides] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [editGuideId, setEditGuideId] = useState(null);
    const [formData, setFormData] = useState({ question: "", answer: "", category: "General" });
    const [guideFormData, setGuideFormData] = useState({ title: "", category: "Marketing", content: "", readTime: "5 min read" });

    useScrollLock(showModal || showGuideModal);
    const [loading, setLoading] = useState(false);
    const [guideLoading, setGuideLoading] = useState(false);

    useEffect(() => {
        setTitle("Help & Training");
        fetchFaqs();
        fetchGuides();
    }, [setTitle]);

    const fetchFaqs = async () => {
        try {
            const { data } = await API.get("/faqs");
            setFaqs(data);
        } catch (err) {
            console.error("Failed to fetch FAQs", err);
        }
    };

    const fetchGuides = async () => {
        try {
            const { data } = await API.get("/guides");
            setGuides(data);
        } catch (err) {
            console.error("Failed to fetch Guides", err);
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

    const handleCreateGuide = async (e) => {
        e.preventDefault();
        setGuideLoading(true);
        try {
            if (editGuideId) {
                await API.put(`/guides/${editGuideId}`, guideFormData);
                toast({ title: "Guide Updated" });
            } else {
                await API.post("/guides", guideFormData);
                toast({ title: "Guide Created" });
            }
            setShowGuideModal(false);
            setEditGuideId(null);
            setGuideFormData({ title: "", category: "Marketing", content: "", readTime: "5 min read" });
            fetchGuides();
        } catch (err) {
            toast({ title: "Error", description: err.response?.data?.message || "Failed to save guide", variant: "destructive" });
        }
        setGuideLoading(false);
    };

    const openEditGuide = (guide) => {
        setEditGuideId(guide._id);
        setGuideFormData({
            title: guide.title,
            category: guide.category,
            content: guide.content,
            readTime: guide.readTime
        });
        setShowGuideModal(true);
    };

    const handleDeleteGuide = async (id) => {
        if (window.confirm("Are you sure you want to delete this Guide?")) {
            try {
                await API.delete(`/guides/${id}`);
                toast({ title: "Guide Deleted" });
                fetchGuides();
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
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1"><BookOpen className="h-4 w-4" /> Vendor Academy Content</h3>
                            {guides.length < 3 && (
                                <button onClick={() => { setEditGuideId(null); setGuideFormData({ title: "", category: "Marketing", content: "", readTime: "5 min read" }); setShowGuideModal(true); }} className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700">
                                    + Add Guide
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {guides.length === 0 ? (
                                <div className="col-span-1 sm:col-span-2 p-4 text-center text-sm text-gray-500 border rounded-2xl">No Guides found.</div>
                            ) : guides.map((item) => (
                                <div key={item._id} className="p-5 rounded-2xl border border-border bg-white shadow-sm group hover:border-emerald-500 transition-all cursor-pointer border-gray-100 relative">
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); openEditGuide(item); }} className="text-gray-300 hover:text-blue-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteGuide(item._id); }} className="text-gray-300 hover:text-rose-500">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mb-4 pr-12">
                                        <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{item.category}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 leading-tight mb-2 pr-4">{item.title}</h4>
                                    <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1 uppercase tracking-tight">{item.readTime} <ExternalLink className="h-2.5 w-2.5 ml-1" /></p>
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
                        <button onClick={() => navigate("/admin/support")} className="w-full py-3 bg-white text-blue-800 rounded-xl font-black text-xs hover:bg-blue-50 transition shadow-md">Open Chat Console</button>
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

            {/* Modal for Create Guide */}
            {showGuideModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-foreground">{editGuideId ? "Edit Vendor Guide" : "Create Vendor Guide"}</h3>
                            <button onClick={() => { setShowGuideModal(false); setEditGuideId(null); }}><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleCreateGuide} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-600">Guide Title</label>
                                    <input type="text" required value={guideFormData.title} onChange={(e) => setGuideFormData({ ...guideFormData, title: e.target.value })}
                                        className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600">Category (e.g. Marketing)</label>
                                    <input type="text" required value={guideFormData.category} onChange={(e) => setGuideFormData({ ...guideFormData, category: e.target.value })}
                                        className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">Read Time (e.g. 5 min read)</label>
                                <input type="text" required value={guideFormData.readTime} onChange={(e) => setGuideFormData({ ...guideFormData, readTime: e.target.value })}
                                    className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm focus:border-emerald-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600">Content (Markdown / HTML supported)</label>
                                <textarea required value={guideFormData.content} onChange={(e) => setGuideFormData({ ...guideFormData, content: e.target.value })}
                                    className="w-full h-64 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm focus:border-emerald-500 focus:outline-none font-mono" />
                            </div>
                            <button type="submit" disabled={guideLoading} className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 transition">
                                {guideLoading ? "Saving..." : (editGuideId ? "Save Changes" : "Publish Guide")}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHelpTraining;
