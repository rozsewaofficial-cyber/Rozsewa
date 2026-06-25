import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Image as ImageIcon, ToggleLeft, ToggleRight, Trash2, Edit3, X, Save, Camera, Loader2, Target, Presentation, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const InputField = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

const AdminBanners = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);

    useScrollLock(showForm);
    const [isUploading, setIsUploading] = useState(false);
    const [form, setForm] = useState({
        title: "",
        description: "",
        imageUrl: "",
        ctaLink: "/shops",
        ctaText: "Book Now",
        active: true
    });

    useEffect(() => {
        setTitle("Banner Management");
        fetchBanners();
    }, [setTitle]);

    const fetchBanners = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/banners");
            setBanners(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.title || !form.imageUrl) {
            toast({ title: "Title and Image are required", variant: "destructive" });
            return;
        }

        try {
            if (editId) {
                const { data } = await API.put(`/admin/banners/${editId}`, form);
                setBanners(banners.map(b => b._id === editId ? data : b));
                toast({ title: "Banner Updated Successfully" });
            } else {
                const { data } = await API.post("/admin/banners", form);
                setBanners([data, ...banners]);
                toast({ title: "Banner Created Successfully" });
            }
            resetForm();
        } catch (err) {
            toast({ title: "Operation Failed", variant: "destructive" });
        }
    };

    const resetForm = () => {
        setForm({ title: "", description: "", imageUrl: "", ctaLink: "/shops", ctaText: "Book Now", active: true });
        setShowForm(false);
        setEditId(null);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const data = new FormData();
        data.append("image", file);
        setIsUploading(true);

        try {
            const res = await API.post("/upload", data, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setForm({ ...form, imageUrl: res.data.url });
            toast({ title: "Image Uploaded" });
        } catch (err) {
            toast({ title: "Upload Failed", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Remove this banner?")) return;
        try {
            await API.delete(`/admin/banners/${id}`);
            setBanners(banners.filter(b => b._id !== id));
            toast({ title: "Banner Deleted" });
        } catch (err) {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    const toggleActive = async (id) => {
        try {
            const { data } = await API.patch(`/admin/banners/${id}/status`);
            setBanners(banners.map(b => b._id === id ? data : b));
        } catch (err) {
            toast({ title: "Toggle Failed", variant: "destructive" });
        }
    };

    // Stats
    const stats = useMemo(() => {
        let active = 0;
        let paused = 0;
        banners.forEach(b => {
            if (b.active) active++;
            else paused++;
        });
        return { total: banners.length, active, paused };
    }, [banners]);

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Active Promotions</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage homepage banners and marketing campaigns.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4" /> New Campaign
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                    { label: "Total Campaigns", value: stats.total, icon: Presentation, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Active Banners", value: stats.active, icon: Target, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Paused/Hidden", value: stats.paused, icon: EyeOff, cls: "text-amber-700 bg-amber-50 border-amber-200" },
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

            {/* Data Grid */}
            {loading ? (
                <div className="flex h-60 flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Banners...</p>
                </div>
            ) : banners.length === 0 ? (
                <div className="col-span-full flex flex-col items-center py-20 text-center rounded-2xl border border-dashed border-gray-300 bg-gray-50">
                    <ImageIcon className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-bold text-gray-500">No active campaigns found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {banners.map((b) => (
                        <motion.div
                            key={b._id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`group flex flex-col rounded-2xl border bg-white overflow-hidden transition-all hover:shadow-md ${b.active ? "border-gray-200 hover:border-blue-200" : "border-red-100 bg-red-50/10 grayscale-[50%]"}`}
                        >
                            <div className="relative h-48 bg-gray-50 overflow-hidden">
                                {b.imageUrl ? (
                                    <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-gray-200" /></div>
                                )}
                                <div className="absolute top-3 right-3">
                                    <button
                                        onClick={() => toggleActive(b._id)}
                                        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all bg-white/90 backdrop-blur-sm shadow-sm ${b.active ? "text-emerald-500 hover:text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}
                                    >
                                        {b.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                                    </button>
                                </div>
                                {!b.active && (
                                    <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/50 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest">
                                        Hidden
                                    </div>
                                )}
                            </div>

                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex-1">
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight leading-tight mb-1 truncate">{b.title}</h3>
                                    <p className="text-xs text-gray-500 font-medium line-clamp-2">{b.description || "No description provided."}</p>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t border-gray-100 mt-4">
                                    <button
                                        onClick={() => {
                                            setForm({ ...b });
                                            setEditId(b._id);
                                            setShowForm(true);
                                        }}
                                        className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                        <Edit3 className="h-3.5 w-3.5" /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(b._id)}
                                        className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Remove
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showForm && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                            onClick={resetForm}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl pointer-events-auto custom-scrollbar flex flex-col">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-sm">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900">{editId ? "Update Campaign" : "New Campaign"}</h3>
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Banner Details</p>
                                    </div>
                                    <button onClick={resetForm} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <form onSubmit={handleSave} className="p-6 space-y-6 bg-gray-50/30">
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Visuals
                                        </h4>
                                        <label className={`relative flex flex-col items-center justify-center w-full h-40 rounded-xl border border-dashed cursor-pointer overflow-hidden transition-all ${form.imageUrl ? 'border-emerald-500 bg-white shadow-sm' : 'border-gray-300 bg-white hover:bg-gray-50'}`}>
                                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                            {form.imageUrl ? (
                                                <img src={form.imageUrl} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    {isUploading ? (
                                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
                                                    ) : (
                                                        <Camera className="h-6 w-6 text-gray-300 mb-2" />
                                                    )}
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Upload Banner (1200x400)</span>
                                                </div>
                                            )}
                                            {form.imageUrl && (
                                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Change Image</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Campaign Information
                                        </h4>
                                        <div className="space-y-4">
                                            <InputField label="Headline">
                                                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="e.g. 50% Off Festive Sale" required />
                                            </InputField>
                                            <InputField label="Promo Text">
                                                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputCls} resize-y min-h-[80px]`} placeholder="Describe the offer or campaign..." />
                                            </InputField>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Status Settings
                                        </h4>
                                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
                                            <div>
                                                <p className="text-sm font-black text-gray-900">Mark as Active</p>
                                                <p className="text-[10px] font-bold text-gray-500 mt-1">If unchecked, this banner won't show on the homepage.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                </form>

                                <div className="p-5 border-t border-gray-100 bg-white flex gap-3">
                                    <button type="button" onClick={resetForm} className="flex-1 h-12 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 h-12 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50">
                                        <Save className="h-3 w-3 inline mr-1.5" /> {editId ? "Update Campaign" : "Launch Campaign"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
};

export default AdminBanners;
