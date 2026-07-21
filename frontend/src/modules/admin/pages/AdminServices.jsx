import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Loader2, Image as ImageIcon, Layers, X, Briefcase, Zap, CheckCircle2, ChevronRight, Sparkles, FolderTree } from "lucide-react";
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

    const [activeTab, setActiveTab] = useState("categories"); // "categories" | "subcategories"
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Category Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
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
        services: []
    });

    // Subcategories & Services Management State
    const [selectedCatId, setSelectedCatId] = useState("");
    const [subcategories, setSubcategories] = useState([]);
    const [loadingSubcategories, setLoadingSubcategories] = useState(false);
    const [showSubModal, setShowSubModal] = useState(false);
    const [editingSub, setEditingSub] = useState(null);
    const [newSub, setNewSub] = useState({
        name: "",
        categoryId: "",
        description: "",
        image: "",
        icon: "Wrench",
        isActive: true,
        index: 0
    });

    // Subcategory Service Modal State
    const [selectedSubForService, setSelectedSubForService] = useState(null);
    const [subServices, setSubServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [newService, setNewService] = useState({
        name: "",
        description: "",
        price: 199,
        duration: "30 min",
        image: "",
        visible: true
    });

    useScrollLock(showModal || showSubModal || showServiceModal);

    useEffect(() => {
        setTitle("Industries & Hierarchy Services");
        fetchCategories();
    }, [setTitle]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/categories");
            setCategories(data || []);
            if (data?.length > 0 && !selectedCatId) {
                setSelectedCatId(data[0]._id);
            }
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "subcategories" && selectedCatId) {
            fetchSubcategories(selectedCatId);
        }
    }, [activeTab, selectedCatId]);

    const fetchSubcategories = async (catId) => {
        setLoadingSubcategories(true);
        try {
            const { data } = await API.get(`/admin/subcategories?categoryId=${catId}`);
            setSubcategories(data || []);
        } catch (err) {
            toast({ title: "Fetch Subcategories Failed", variant: "destructive" });
        } finally {
            setLoadingSubcategories(false);
        }
    };

    useEffect(() => {
        if (selectedSubForService) {
            fetchServicesForSubcategory(selectedSubForService._id);
        }
    }, [selectedSubForService]);

    const fetchServicesForSubcategory = async (subId) => {
        setLoadingServices(true);
        try {
            const { data } = await API.get(`/public/subcategories/${subId}/services`);
            setSubServices(data || []);
        } catch (err) {
            toast({ title: "Fetch Services Failed", variant: "destructive" });
        } finally {
            setLoadingServices(false);
        }
    };

    const handleFileUpload = async (e, targetStateSetter, currentState) => {
        const file = e.target.files[0];
        if (!file) return;
        const upData = new FormData();
        upData.append("image", file);
        setIsUploading(true);
        try {
            const { data } = await API.post("/upload", upData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            targetStateSetter({ ...currentState, image: data.url });
            toast({ title: "Photo Uploaded" });
        } catch { toast({ title: "Upload Failed", variant: "destructive" }); }
        finally { setIsUploading(false); }
    };

    // Category CRUD
    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!newCat.name) return;

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
        const ok = await confirm("This will permanently delete the category and all base services.", { title: "Delete Industry", confirmLabel: "Delete", destructive: true });
        if (!ok) return;
        try {
            await API.delete(`/admin/categories/${id}`);
            setCategories(categories.filter(c => c._id !== id));
            toast({ title: "Category Removed" });
        } catch (err) {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    // Subcategory CRUD
    const handleSaveSubcategory = async (e) => {
        e.preventDefault();
        if (!newSub.name || !newSub.categoryId) return;
        try {
            if (editingSub) {
                const { data } = await API.put(`/admin/subcategories/${editingSub._id}`, newSub);
                setSubcategories(subcategories.map(s => s._id === data._id ? data : s));
                toast({ title: "Subcategory Updated" });
            } else {
                const { data } = await API.post("/admin/subcategories", newSub);
                setSubcategories([...subcategories, data]);
                toast({ title: "Subcategory Created" });
            }
            setShowSubModal(false);
            setEditingSub(null);
        } catch (err) {
            toast({ title: "Subcategory Save Failed", variant: "destructive" });
        }
    };

    const deleteSubcategory = async (id) => {
        const ok = await confirm("Delete subcategory and all associated services?", { title: "Delete Subcategory", confirmLabel: "Delete", destructive: true });
        if (!ok) return;
        try {
            await API.delete(`/admin/subcategories/${id}`);
            setSubcategories(subcategories.filter(s => s._id !== id));
            if (selectedSubForService?._id === id) setSelectedSubForService(null);
            toast({ title: "Subcategory Deleted" });
        } catch (err) {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    // Service CRUD
    const handleSaveService = async (e) => {
        e.preventDefault();
        if (!newService.name || !selectedSubForService) return;

        try {
            if (editingService) {
                const { data } = await API.put(`/admin/services/${editingService._id}`, newService);
                setSubServices(subServices.map(s => s._id === data._id ? data : s));
                toast({ title: "Service Updated" });
            } else {
                const { data } = await API.post(`/admin/subcategories/${selectedSubForService._id}/services`, {
                    ...newService,
                    categoryId: selectedSubForService.categoryId?._id || selectedSubForService.categoryId
                });
                setSubServices([data, ...subServices]);
                toast({ title: "Service Created" });
            }
            setShowServiceModal(false);
            setEditingService(null);
        } catch (err) {
            toast({ title: "Service Save Failed", variant: "destructive" });
        }
    };

    const deleteService = async (id) => {
        const ok = await confirm("Delete this service item?", { title: "Delete Service", confirmLabel: "Delete", destructive: true });
        if (!ok) return;
        try {
            await API.delete(`/admin/services/${id}`);
            setSubServices(subServices.filter(s => s._id !== id));
            toast({ title: "Service Removed" });
        } catch (err) {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    const filteredCategories = (categories || []).filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Industries & Partner Services Hierarchy</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage Categories, Subcategories, and Partner Mode Services.</p>
                </div>

                <div className="flex items-center gap-3">
                    {activeTab === "categories" ? (
                        <button
                            onClick={() => {
                                setEditingCat(null);
                                setNewCat({ name: "", icon: "Scissors", description: "", image: "", isComingSoon: false, partnerCommissionBasic: 25, partnerCommissionStandard: 20, partnerCommissionPremium: 15, businessModel: "commission", defaultLeadPrice: 0, services: [] });
                                setShowModal(true);
                            }}
                            className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95"
                        >
                            <Plus className="h-4 w-4" /> Add Category
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setEditingSub(null);
                                setNewSub({ name: "", categoryId: selectedCatId, description: "", image: "", icon: "Wrench", isActive: true, index: 0 });
                                setShowSubModal(true);
                            }}
                            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
                        >
                            <Plus className="h-4 w-4" /> Add Subcategory
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab("categories")}
                    className={`py-3 px-6 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === "categories"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    1. Main Categories ({categories.length})
                </button>
                <button
                    onClick={() => setActiveTab("subcategories")}
                    className={`py-3 px-6 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === "subcategories"
                            ? "border-emerald-600 text-emerald-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                    2. Subcategories & Services Hierarchy
                </button>
            </div>

            {/* TAB 1: CATEGORIES */}
            {activeTab === "categories" && (
                <div className="space-y-6">
                    <div className="relative w-full lg:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                            placeholder="Search categories..."
                        />
                    </div>

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
                                    className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
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
                                            <button onClick={() => {
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
                                            }} className="h-8 w-8 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg border border-transparent hover:border-blue-100 transition-colors">
                                                <Edit className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => deleteCategory(cat._id)} className="h-8 w-8 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg border border-transparent hover:border-red-100 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-black text-gray-900 tracking-tight mb-1">{cat.name}</h3>
                                    <p className="text-xs text-gray-500 font-medium mb-4 line-clamp-2">{cat.description || "No description provided."}</p>

                                    <button
                                        onClick={() => {
                                            setSelectedCatId(cat._id);
                                            setActiveTab("subcategories");
                                        }}
                                        className="mt-auto w-full py-2.5 px-4 rounded-xl bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 font-bold text-xs flex items-center justify-between border border-gray-100 transition-all"
                                    >
                                        <span>Manage Subcategories</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: SUBCATEGORIES & SERVICES */}
            {activeTab === "subcategories" && (
                <div className="space-y-6">
                    {/* Select Main Category */}
                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200">
                        <label className="text-xs font-black uppercase text-gray-500 shrink-0">Category:</label>
                        <select
                            value={selectedCatId}
                            onChange={(e) => {
                                setSelectedCatId(e.target.value);
                                setSelectedSubForService(null);
                            }}
                            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm font-bold focus:outline-none"
                        >
                            {categories.map((c) => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Subcategories List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                                    <FolderTree className="h-4 w-4 text-emerald-600" />
                                    Subcategories
                                </h3>
                                <span className="text-xs font-bold text-gray-400">{subcategories.length} item(s)</span>
                            </div>

                            {loadingSubcategories ? (
                                <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
                                </div>
                            ) : subcategories.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-xs font-bold text-gray-400">No subcategories created for this category.</p>
                                    <button
                                        onClick={() => {
                                            setEditingSub(null);
                                            setNewSub({ name: "", categoryId: selectedCatId, description: "", image: "", icon: "Wrench", isActive: true, index: 0 });
                                            setShowSubModal(true);
                                        }}
                                        className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
                                    >
                                        + Add First Subcategory
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {subcategories.map((sub) => {
                                        const isSelected = selectedSubForService?._id === sub._id;
                                        return (
                                            <div
                                                key={sub._id}
                                                onClick={() => setSelectedSubForService(sub)}
                                                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? "bg-emerald-50/50 border-emerald-500 shadow-sm"
                                                        : "bg-white border-gray-200 hover:border-gray-300"
                                                }`}
                                            >
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900">{sub.name}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">{sub.description || "No description"}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingSub(sub);
                                                            setNewSub(sub);
                                                            setShowSubModal(true);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteSubcategory(sub._id);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                    <ChevronRight className={`h-4 w-4 ${isSelected ? "text-emerald-600" : "text-gray-300"}`} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Services under selected subcategory */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-wider text-gray-700 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-blue-600" />
                                    {selectedSubForService ? `Services in "${selectedSubForService.name}"` : "Services"}
                                </h3>
                                {selectedSubForService && (
                                    <button
                                        onClick={() => {
                                            setEditingService(null);
                                            setNewService({ name: "", description: "", price: 199, duration: "30 min", image: "", visible: true });
                                            setShowServiceModal(true);
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Service
                                    </button>
                                )}
                            </div>

                            {!selectedSubForService ? (
                                <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-xs font-bold text-gray-400">Select a subcategory on the left to manage its associated services.</p>
                                </div>
                            ) : loadingServices ? (
                                <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                                </div>
                            ) : subServices.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                    <p className="text-xs font-bold text-gray-400">No service items added yet under {selectedSubForService.name}.</p>
                                    <button
                                        onClick={() => {
                                            setEditingService(null);
                                            setNewService({ name: "", description: "", price: 199, duration: "30 min", image: "", visible: true });
                                            setShowServiceModal(true);
                                        }}
                                        className="mt-3 text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        + Create First Service
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {subServices.map((svc) => (
                                        <div key={svc._id} className="p-4 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">{svc.name}</h4>
                                                <p className="text-xs text-gray-500 line-clamp-1">{svc.description || "No description"}</p>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-emerald-600">
                                                    <span>₹{svc.price}</span>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="text-gray-500">{svc.duration}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditingService(svc);
                                                        setNewService(svc);
                                                        setShowServiceModal(true);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteService(svc._id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Subcategory Edit/Create Modal */}
            <AnimatePresence>
                {showSubModal && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setShowSubModal(false)} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                                <h3 className="text-lg font-black text-gray-900">{editingSub ? "Edit Subcategory" : "New Subcategory"}</h3>
                                <form onSubmit={handleSaveSubcategory} className="space-y-4">
                                    <InputField label="Subcategory Name">
                                        <input type="text" value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} className={inputCls} required />
                                    </InputField>
                                    <InputField label="Description">
                                        <textarea value={newSub.description} onChange={e => setNewSub({ ...newSub, description: e.target.value })} className={inputCls} />
                                    </InputField>
                                    <div className="flex gap-3">
                                        <button type="button" onClick={() => setShowSubModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-xs text-gray-500">Cancel</button>
                                        <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs">Save Subcategory</button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Service Edit/Create Modal */}
            <AnimatePresence>
                {showServiceModal && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={() => setShowServiceModal(false)} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                                <h3 className="text-lg font-black text-gray-900">{editingService ? "Edit Service" : "New Service Item"}</h3>
                                <form onSubmit={handleSaveService} className="space-y-4">
                                    <InputField label="Service Name">
                                        <input type="text" value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} className={inputCls} required />
                                    </InputField>
                                    <InputField label="Short Description">
                                        <textarea value={newService.description} onChange={e => setNewService({ ...newService, description: e.target.value })} className={inputCls} />
                                    </InputField>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputField label="Starting Price (₹)">
                                            <input type="number" min="0" value={newService.price} onChange={e => setNewService({ ...newService, price: Number(e.target.value) })} className={inputCls} required />
                                        </InputField>
                                        <InputField label="Duration">
                                            <input type="text" value={newService.duration} onChange={e => setNewService({ ...newService, duration: e.target.value })} className={inputCls} placeholder="e.g. 30 min" />
                                        </InputField>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowServiceModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-xs text-gray-500">Cancel</button>
                                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs">Save Service Item</button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminServices;
