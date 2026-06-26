import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { Plus, Edit, Trash2, ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, Save, X, GripVertical, FileText, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const InputField = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

const AdminBenefitPolicies = () => {
    const { toast } = useToast();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState(null);

    useScrollLock(showModal);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");

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

    const icons = { ShieldCheck, Zap, TrendingUp, Users, Headphones, Star, FileText, CheckCircle2 };
    const colors = [
        { label: "Emerald", text: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Amber", text: "text-amber-600", bg: "bg-amber-50" },
        { label: "Blue", text: "text-blue-600", bg: "bg-blue-50" },
        { label: "Purple", text: "text-purple-600", bg: "bg-purple-50" },
        { label: "Rose", text: "text-rose-600", bg: "bg-rose-50" },
        { label: "Gray", text: "text-gray-600", bg: "bg-gray-50" }
    ];

    useEffect(() => {
        // Set document title logic is usually in Layout or OutletContext, but skipping here to match others if context isn't used
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

    // Stats and Filters
    const stats = useMemo(() => {
        let active = 0;
        let benefits = 0;
        let policiesCount = 0;
        policies.forEach(p => {
            if (p.isActive) active++;
            if (p.type === 'benefit') benefits++;
            else if (p.type === 'policy') policiesCount++;
        });
        return { total: policies.length, active, benefits, policies: policiesCount };
    }, [policies]);

    const filteredPolicies = policies.filter(p => {
        const matchesSearch = p.title?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || p.type === filterType;
        return matchesSearch && matchesType;
    }).sort((a, b) => a.displayOrder - b.displayOrder);

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Benefits & Policies</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage the dynamic content shown to providers during onboarding.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4" /> Add Record
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Records", value: stats.total, icon: FileText, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Active Items", value: stats.active, icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Core Benefits", value: stats.benefits, icon: Star, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Platform Policies", value: stats.policies, icon: ShieldCheck, cls: "text-purple-700 bg-purple-50 border-purple-200" },
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

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { key: "all", label: "All Items", count: stats.total },
                        { key: "benefit", label: "Benefits", count: stats.benefits },
                        { key: "policy", label: "Policies", count: stats.policies },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilterType(f.key)}
                            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${filterType === f.key ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                        >
                            {f.label}
                            <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-black ${filterType === f.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                {f.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Data Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse border border-gray-200" />)}
                </div>
            ) : filteredPolicies.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-200">
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-500">No records found matching your filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPolicies.map((policy) => {
                        const Icon = icons[policy.icon] || ShieldCheck;
                        return (
                            <motion.div
                                key={policy._id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all h-full ${!policy.isActive ? 'border-red-100 bg-red-50/10 grayscale-[50%]' : 'border-gray-200 hover:border-blue-200'}`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center border border-white/20 shadow-sm ${policy.bgColor} ${policy.color}`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => handleOpenModal(policy)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                            <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(policy._id)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight leading-tight">{policy.title}</h3>
                                    {!policy.isActive && (
                                        <span className="shrink-0 px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 text-[9px] font-black uppercase tracking-widest mt-0.5">
                                            Hidden
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-gray-500 font-medium mb-4 line-clamp-3 flex-1">
                                    {policy.description}
                                </p>

                                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${policy.type === 'benefit' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                                        {policy.type}
                                    </span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
                                        <GripVertical className="h-3 w-3" /> Ord: {policy.displayOrder}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl pointer-events-auto custom-scrollbar flex flex-col">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-sm">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900">{editingPolicy ? "Edit Record" : "New Content Record"}</h3>
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Benefit or Policy Setup</p>
                                    </div>
                                    <button onClick={() => setShowModal(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6 space-y-8 bg-gray-50/30">
                                    
                                    {/* General Info */}
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Content Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <InputField label="Title">
                                                    <input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputCls} placeholder="e.g. Verified Pro Status" />
                                                </InputField>
                                            </div>
                                            <InputField label="Content Type">
                                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className={inputCls}>
                                                    <option value="benefit">Provider Benefit (Grid)</option>
                                                    <option value="policy">Platform Policy (List)</option>
                                                </select>
                                            </InputField>
                                            <InputField label="Display Order">
                                                <input type="number" required value={formData.displayOrder} onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })} className={inputCls} />
                                            </InputField>
                                            <div className="md:col-span-2">
                                                <InputField label="Description text">
                                                    <textarea required rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className={`${inputCls} resize-y min-h-[80px]`} placeholder="Detailed explanation..." />
                                                </InputField>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Theme */}
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Icon & Color Theme
                                        </h4>
                                        <div className="space-y-4 p-5 rounded-xl border border-gray-200 bg-white shadow-sm">
                                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                {Object.keys(icons).map(iconName => {
                                                    const IconComp = icons[iconName];
                                                    return (
                                                        <button
                                                            key={iconName}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, icon: iconName })}
                                                            className={`h-12 rounded-xl flex items-center justify-center transition-all border ${formData.icon === iconName ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'}`}
                                                        >
                                                            <IconComp className="h-5 w-5" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                                {colors.map(c => (
                                                    <button
                                                        key={c.label}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, color: c.text, bgColor: c.bg })}
                                                        className={`h-8 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${formData.color === c.text ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                                                    >
                                                        {c.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Status Settings
                                        </h4>
                                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white">
                                            <div>
                                                <p className="text-sm font-black text-gray-900">Mark as Active</p>
                                                <p className="text-[10px] font-bold text-gray-500 mt-1">If unchecked, this record will be hidden globally.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                </form>

                                <div className="p-5 border-t border-gray-100 bg-white flex gap-3">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                                    <button onClick={handleSubmit} className="flex-1 h-12 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all">
                                        <Save className="h-3 w-3 inline mr-1.5" /> {editingPolicy ? "Save Changes" : "Create Record"}
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

export default AdminBenefitPolicies;
