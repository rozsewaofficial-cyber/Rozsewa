import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Save, X, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const AdminBenefitPolicies = () => {
    const { toast } = useToast();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        icon: "ShieldCheck",
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
        type: "benefit",
        isActive: true,
        displayOrder: 0
    });

    const icons = { ShieldCheck, Zap, TrendingUp, Users, Headphones, Star };
    const colors = [
        { label: "Emerald", text: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Amber", text: "text-amber-600", bg: "bg-amber-50" },
        { label: "Blue", text: "text-blue-600", bg: "bg-blue-50" },
        { label: "Purple", text: "text-purple-600", bg: "bg-purple-50" },
        { label: "Rose", text: "text-rose-600", bg: "bg-rose-50" },
        { label: "Yellow", text: "text-yellow-600", bg: "bg-yellow-50" }
    ];

    useEffect(() => {
        fetchPolicies();
    }, []);

    const fetchPolicies = async () => {
        try {
            const { data } = await API.get("/admin/benefit-policies");
            setPolicies(data);
        } catch (err) {
            toast({ title: "Error fetching policies", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (policy = null) => {
        if (policy) {
            setEditingPolicy(policy);
            setFormData(policy);
        } else {
            setEditingPolicy(null);
            setFormData({
                title: "",
                description: "",
                icon: "ShieldCheck",
                color: "text-emerald-600",
                bgColor: "bg-emerald-50",
                type: "benefit",
                isActive: true,
                displayOrder: policies.length
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPolicy) {
                await API.put(`/admin/benefit-policies/${editingPolicy._id}`, formData);
                toast({ title: "Policy updated successfully" });
            } else {
                await API.post("/admin/benefit-policies", formData);
                toast({ title: "Policy created successfully" });
            }
            setShowModal(false);
            fetchPolicies();
        } catch (err) {
            toast({ title: "Error saving policy", variant: "destructive" });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this policy?")) return;
        try {
            await API.delete(`/admin/benefit-policies/${id}`);
            toast({ title: "Policy deleted" });
            fetchPolicies();
        } catch (err) {
            toast({ title: "Error deleting policy", variant: "destructive" });
        }
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="text-left">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Benefit & Policy Manager</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage dynamic content for Provider Benefit page</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4" /> Add New Policy
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [...Array(6)].map((_, i) => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-3xl" />)
                ) : (
                    policies.map((policy) => {
                        const Icon = icons[policy.icon] || ShieldCheck;
                        return (
                            <motion.div
                                key={policy._id}
                                layout
                                className={`relative flex flex-col p-6 rounded-3xl border ${policy.isActive ? 'border-slate-100' : 'border-rose-100 bg-rose-50/30'} bg-white shadow-sm group`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`h-12 w-12 rounded-2xl ${policy.bgColor} ${policy.color} flex items-center justify-center`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(policy)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(policy._id)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-left flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${policy.type === 'benefit' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                            {policy.type}
                                        </span>
                                        {!policy.isActive && <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">Inactive</span>}
                                    </div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-tight">{policy.title}</h3>
                                    <p className="text-xs text-slate-400 font-medium mt-2 line-clamp-3">{policy.description}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Order: {policy.displayOrder}</span>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                        {editingPolicy ? "Edit Policy" : "New Policy"}
                                    </h2>
                                    <button type="button" onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-slate-100">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-4 text-left">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Policy Title</label>
                                        <input
                                            required
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 ring-emerald-500/20"
                                            placeholder="e.g. Verified Pro Status"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type</label>
                                            <select
                                                value={formData.type}
                                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold"
                                            >
                                                <option value="benefit">Benefit (Grid)</option>
                                                <option value="policy">Policy (List)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Order</label>
                                            <input
                                                type="number"
                                                value={formData.displayOrder}
                                                onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold"
                                            placeholder="Detailed explanation of the benefit..."
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Icon & Color Theme</label>
                                        <div className="grid grid-cols-6 gap-2">
                                            {Object.keys(icons).map(iconName => {
                                                const IconComp = icons[iconName];
                                                return (
                                                    <button
                                                        key={iconName}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, icon: iconName })}
                                                        className={`h-12 rounded-xl flex items-center justify-center transition-all ${formData.icon === iconName ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                                                    >
                                                        <IconComp className="h-5 w-5" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {colors.map(c => (
                                                <button
                                                    key={c.label}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, color: c.text, bgColor: c.bg })}
                                                    className={`h-8 px-3 rounded-full text-[8px] font-black uppercase tracking-widest border-2 transition-all ${formData.color === c.text ? 'border-emerald-600' : 'border-transparent bg-slate-50'}`}
                                                >
                                                    {c.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="h-4 w-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <label htmlFor="isActive" className="text-xs font-bold text-slate-700">Policy is Active</label>
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all">
                                    <Save className="h-4 w-4 inline mr-2" /> {editingPolicy ? "Save Changes" : "Create Policy"}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminBenefitPolicies;
