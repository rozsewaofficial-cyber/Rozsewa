import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Loader2, Image as ImageIcon, Layers, X, Briefcase, Zap, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";
import { normalizeNonNegativeNumber, validateNonNegativeNumber } from "@/lib/numberValidation";

const InputField = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

const AdminServices = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const confirm = useConfirm();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingCat, setEditingCat] = useState(null);

    useScrollLock(showModal);
    const [isUploading, setIsUploading] = useState(false);

    const [newCat, setNewCat] = useState({
        name: "",
        icon: "Scissors",
        description: "",
        image: "",
        isComingSoon: false,
        partnerCommissionBasic: 25,
        partnerCommissionStandard: 20,
        partnerCommissionPremium: 15,
        businessModel: "commission",
        defaultLeadPrice: 0,
        services: [] // Default sub-services
    });

    useEffect(() => {
        setTitle("Industries & Services");
        fetchCategories();
    }, [setTitle]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/categories");
            setCategories(data);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const upData = new FormData();
        upData.append("image", file);
        setIsUploading(true);
        try {
            const { data } = await API.post("/upload", upData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setNewCat({ ...newCat, image: data.url });
            toast({ title: "Photo Uploaded" });
        } catch { toast({ title: "Upload Failed", variant: "destructive" }); }
        finally { setIsUploading(false); }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!newCat.name) return;

        for (const [idx, service] of newCat.services.entries()) {
            const priceValidation = validateNonNegativeNumber(service.basePrice, { fieldName: `Service ${idx + 1} Base Price`, min: 0 });
            if (!priceValidation.isValid) {
                toast({ title: "Invalid Input", description: priceValidation.error, variant: "destructive" });
                return;
            }
        }

        try {
            if (editingCat) {
                const { data } = await API.put(`/admin/categories/${editingCat._id}`, newCat);
                setCategories(categories.map(c => c._id === data._id ? data : c));
                toast({ title: "Category Updated" });
            } else {
                const { data } = await API.post("/admin/categories", newCat);
                setCategories([...categories, data]);
                toast({ title: "Category Created" });
            }
            setShowModal(false);
            setEditingCat(null);
            setNewCat({ name: "", icon: "Scissors", description: "", image: "", isComingSoon: false, partnerCommissionBasic: 25, partnerCommissionStandard: 20, partnerCommissionPremium: 15, businessModel: "commission", defaultLeadPrice: 0, services: [] });
        } catch (err) {
            toast({ title: "Save Failed", variant: "destructive" });
        }
    };

    const deleteCategory = async (id) => {
        const ok = await confirm("This will permanently delete the category and all its base services.", { title: "Delete Industry", confirmLabel: "Delete", destructive: true });
        if (!ok) return;
        try {
            await API.delete(`/admin/categories/${id}`);
            setCategories(categories.filter(c => c._id !== id));
            toast({ title: "Category Removed" });
        } catch (err) {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    const addServiceRow = () => {
        setNewCat({ ...newCat, services: [...newCat.services, { name: "", basePrice: 0, useCategoryLeadPrice: true, customLeadPrice: 0 }] });
    };

    const removeServiceRow = (idx) => {
        const updated = [...newCat.services];
        updated.splice(idx, 1);
        setNewCat({ ...newCat, services: updated });
    };

    const updateServiceRow = (idx, field, value) => {
        const updated = [...newCat.services];
        updated[idx][field] = value;
        setNewCat({ ...newCat, services: updated });
    };

    const startEdit = (cat) => {
        setEditingCat(cat);
        setNewCat({
            name: cat.name,
            icon: cat.icon || "Scissors",
            description: cat.description || "",
            image: cat.image || "",
            isComingSoon: cat.isComingSoon || false,
            partnerCommissionBasic: cat.partnerCommissionBasic || 25,
            partnerCommissionStandard: cat.partnerCommissionStandard || 20,
            partnerCommissionPremium: cat.partnerCommissionPremium || 15,
            businessModel: cat.businessModel || "commission",
            defaultLeadPrice: cat.defaultLeadPrice || 0,
            services: cat.services || []
        });
        setShowModal(true);
    };

    const filteredCategories = (categories || []).filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Stats
    const stats = useMemo(() => {
        let totalServices = 0;
        let activeCats = 0;
        let comingSoon = 0;
        categories.forEach(c => {
            totalServices += (c.services?.length || 0);
            if (c.isComingSoon) comingSoon++;
            else activeCats++;
        });
        return { categories: categories.length, activeCats, comingSoon, totalServices };
    }, [categories]);


    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Industries & Services</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage global categories, commission tiers, and base services.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCat(null);
                        setNewCat({ name: "", icon: "Scissors", description: "", image: "", isComingSoon: false, partnerCommissionBasic: 25, partnerCommissionStandard: 20, partnerCommissionPremium: 15, businessModel: "commission", defaultLeadPrice: 0, services: [] });
                        setShowModal(true);
                    }}
                    className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4" /> Add Industry
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Industries", value: stats.categories, icon: Briefcase, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Active Categories", value: stats.activeCats, icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Coming Soon", value: stats.comingSoon, icon: Zap, cls: "text-amber-700 bg-amber-50 border-amber-200" },
                    { label: "Listed Services", value: stats.totalServices, icon: Layers, cls: "text-blue-700 bg-blue-50 border-blue-200" },
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

            {/* Search */}
            <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                    placeholder="Search industries or categories..."
                />
            </div>

            {/* Categories Grid */}
            {loading ? (
                <div className="flex h-60 flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Catalog...</p>
                </div>
            ) : filteredCategories.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-200">
                    <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-500">No categories found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredCategories.map(cat => (
                        <motion.div
                            key={cat._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all h-full"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="h-14 w-14 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center border border-gray-100 overflow-hidden shrink-0">
                                    {cat.image ? (
                                        <img src={cat.image} className="h-full w-full object-cover" />
                                    ) : (
                                        <Layers className="h-6 w-6" />
                                    )}
                                </div>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(cat)} className="h-8 w-8 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg border border-transparent hover:border-blue-100 transition-colors">
                                        <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => deleteCategory(cat._id)} className="h-8 w-8 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg border border-transparent hover:border-red-100 transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 items-start mb-1.5">
                                <div className="flex items-center justify-between w-full">
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight leading-tight">{cat.name}</h3>
                                    {cat.isComingSoon && (
                                        <span className="shrink-0 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black uppercase tracking-widest">
                                            Soon
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-1.5 flex-wrap mt-0.5">
                                    {cat.businessModel === 'lead' ? (
                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase tracking-widest">
                                            Lead (₹{cat.defaultLeadPrice})
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">
                                            Commission
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <p className="text-xs text-gray-500 font-medium mb-4 line-clamp-2 min-h-[32px]">
                                {cat.description || "No description provided."}
                            </p>

                            <div className="mt-auto space-y-3 pt-4 border-t border-gray-100">


                                {/* Services tags */}
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Included Services ({cat.services?.length || 0})</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {cat.services?.slice(0, 4).map((s, i) => (
                                            <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-[9px] font-black uppercase text-gray-600 shadow-sm">
                                                {s.name}
                                            </span>
                                        ))}
                                        {(cat.services?.length || 0) > 4 && (
                                            <span className="px-2 py-1 text-[9px] font-black text-gray-400 bg-gray-50 rounded">+{cat.services.length - 4}</span>
                                        )}
                                        {(!cat.services || cat.services.length === 0) && (
                                            <span className="text-[9px] font-bold italic text-gray-300">None defined</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
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
                            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl pointer-events-auto custom-scrollbar flex flex-col">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur-sm">
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900">{editingCat ? "Edit Industry" : "New Industry Category"}</h3>
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Configuration & Tier setup</p>
                                    </div>
                                    <button onClick={() => setShowModal(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <form onSubmit={handleSaveCategory} className="p-6 space-y-8 bg-gray-50/30">
                                    
                                    {/* Section 1: Basic Info */}
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Basic Information
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputField label="Category Name">
                                                <input type="text" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className={inputCls} placeholder="e.g. Salon & Grooming" required />
                                            </InputField>
                                            <InputField label="Icon Name (Lucide)">
                                                <input type="text" value={newCat.icon} onChange={e => setNewCat({ ...newCat, icon: e.target.value })} className={inputCls} placeholder="e.g. Scissors" />
                                            </InputField>
                                            <div className="col-span-1 md:col-span-2">
                                                <InputField label="Description">
                                                    <textarea value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} className={`${inputCls} min-h-[80px] resize-y`} placeholder="Brief summary of this industry..." />
                                                </InputField>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Media & Toggles */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                Visuals
                                            </h4>
                                            <label className="relative flex flex-col items-center justify-center w-full h-32 rounded-xl border border-dashed border-gray-300 bg-white hover:bg-gray-50 cursor-pointer overflow-hidden transition-all">
                                                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                                                {newCat.image ? (
                                                    <img src={newCat.image} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <ImageIcon className="h-6 w-6 text-gray-300 mb-2" />
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Upload Banner</span>
                                                    </div>
                                                )}
                                                {isUploading && (
                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                                    </div>
                                                )}
                                            </label>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                Status Settings
                                            </h4>
                                            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white h-32">
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">Mark "Coming Soon"</p>
                                                    <p className="text-[10px] font-bold text-gray-500 mt-1">Locks selection for providers and users.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" checked={newCat.isComingSoon} onChange={e => setNewCat({ ...newCat, isComingSoon: e.target.checked })} />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Business Model Settings */}
                                    <div className="space-y-4 pt-4 border-t border-gray-100">
                                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            Business Model Setup
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <InputField label="Business Model">
                                                <select
                                                    value={newCat.businessModel}
                                                    onChange={e => setNewCat({ ...newCat, businessModel: e.target.value })}
                                                    className={inputCls}
                                                >
                                                    <option value="commission">Commission-Based</option>
                                                    <option value="lead">Lead-Based</option>
                                                </select>
                                            </InputField>

                                            {newCat.businessModel === 'lead' ? (
                                                <InputField label="Default Lead Price (₹)">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={newCat.defaultLeadPrice}
                                                        onChange={e => setNewCat({ ...newCat, defaultLeadPrice: Number(e.target.value) })}
                                                        className={inputCls}
                                                        placeholder="e.g. 100"
                                                        required
                                                    />
                                                </InputField>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2 col-span-1">
                                                    <InputField label="Basic %">
                                                        <input type="number" min="0" max="100" value={newCat.partnerCommissionBasic} onChange={e => setNewCat({ ...newCat, partnerCommissionBasic: Number(e.target.value) })} className={inputCls} />
                                                    </InputField>
                                                    <InputField label="Standard %">
                                                        <input type="number" min="0" max="100" value={newCat.partnerCommissionStandard} onChange={e => setNewCat({ ...newCat, partnerCommissionStandard: Number(e.target.value) })} className={inputCls} />
                                                    </InputField>
                                                    <InputField label="Premium %">
                                                        <input type="number" min="0" max="100" value={newCat.partnerCommissionPremium} onChange={e => setNewCat({ ...newCat, partnerCommissionPremium: Number(e.target.value) })} className={inputCls} />
                                                    </InputField>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section 4: Managed Services */}
                                    <div className="space-y-4 pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center">
                                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                Base Services
                                            </h4>
                                            <button type="button" onClick={addServiceRow} className="text-[10px] h-7 px-3 flex items-center justify-center bg-gray-100 rounded text-gray-600 font-black uppercase tracking-widest hover:bg-gray-200 transition-colors">
                                                <Plus className="h-3 w-3 mr-1" /> Add
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {newCat.services.length === 0 ? (
                                                <p className="text-center py-6 text-[10px] font-bold uppercase tracking-widest italic text-gray-300 border border-dashed border-gray-200 rounded-xl bg-white">No base services added yet.</p>
                                            ) : (
                                                newCat.services.map((s, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
                                                        <div className="h-8 w-8 rounded bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 shrink-0 border border-gray-100">{idx + 1}</div>
                                                        <input type="text" placeholder="Service Name" value={s.name} onChange={e => updateServiceRow(idx, 'name', e.target.value)} className="flex-1 rounded-lg border-none bg-transparent px-2 text-sm font-bold focus:ring-0 outline-none" required />
                                                        <div className="relative w-36 shrink-0 border-l border-gray-100 pl-2">
                                                            {newCat.businessModel === 'lead' ? (
                                                                <div className="flex flex-col items-start gap-1 justify-center h-full">
                                                                    <label className="flex items-center gap-1 text-[9px] font-bold text-gray-500 cursor-pointer">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={s.useCategoryLeadPrice !== false} 
                                                                            onChange={e => updateServiceRow(idx, 'useCategoryLeadPrice', e.target.checked)}
                                                                            className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
                                                                        />
                                                                        Default (₹{newCat.defaultLeadPrice})
                                                                    </label>
                                                                    {s.useCategoryLeadPrice === false && (
                                                                        <div className="relative mt-1">
                                                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] uppercase font-black">₹</span>
                                                                            <input 
                                                                                type="number" 
                                                                                min="0" 
                                                                                placeholder="Lead Price" 
                                                                                value={s.customLeadPrice || 0} 
                                                                                onChange={e => updateServiceRow(idx, 'customLeadPrice', normalizeNonNegativeNumber(e.target.value))} 
                                                                                className="w-full rounded-lg border border-gray-200 py-1 pl-4 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 bg-white" 
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] uppercase font-black">₹</span>
                                                                    <input type="number" min="0" placeholder="Base" value={s.basePrice} onChange={e => updateServiceRow(idx, 'basePrice', normalizeNonNegativeNumber(e.target.value))} className="w-full rounded-lg border-none bg-transparent py-1.5 pl-6 text-sm font-bold focus:ring-0 outline-none" />
                                                                </>
                                                            )}
                                                        </div>
                                                        <button type="button" onClick={() => removeServiceRow(idx)} className="h-8 w-8 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg shrink-0 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </form>

                                <div className="p-5 border-t border-gray-100 bg-white flex gap-3">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                                    <button onClick={handleSaveCategory} className="flex-1 h-12 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all">Save Industry</button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminServices;
