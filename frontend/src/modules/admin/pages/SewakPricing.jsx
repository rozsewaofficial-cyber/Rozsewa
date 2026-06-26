import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import {
    IndianRupee, Save, Loader2, Search, Briefcase,
    AlertCircle, TrendingUp, Info, Zap, Tag,
    Plus, Trash2, Gift, CheckCircle2, X, ChevronDown, ChevronUp, Edit3, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const InputField = ({ label, children }) => (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
        {children}
    </div>
);

const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all";

const SewakPricing = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [savingId, setSavingId] = useState(null);
    const [expandedCatId, setExpandedCatId] = useState(null);
    const [showDrawer, setShowDrawer] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);

    useScrollLock(showDrawer);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedCatIdx, setSelectedCatIdx] = useState(null);
    const [selectedSvcIdx, setSelectedSvcIdx] = useState(null);

    useEffect(() => {
        setTitle("Sewak Pricing Control");
        fetchCategories();
    }, [setTitle]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data } = await API.get("/admin/categories");
            setCategories(data);
            if (data.length > 0) setExpandedCatId(data[0]._id);
        } catch (err) {
            toast({ title: "Fetch Failed", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const updatePrice = (catIdx, serviceIdx, field, newPrice) => {
        setCategories(prev => {
            const updated = [...prev];
            const cat = { ...updated[catIdx] };
            const svcs = [...cat.services];
            svcs[serviceIdx] = { ...svcs[serviceIdx], [field]: Number(newPrice) };
            cat.services = svcs;
            updated[catIdx] = cat;
            return updated;
        });
    };

    const updateComboPrice = (catIdx, comboIdx, newPrice) => {
        setCategories(prev => {
            const updated = [...prev];
            const cat = { ...updated[catIdx] };
            const combos = [...(cat.combos || [])];
            combos[comboIdx] = { ...combos[comboIdx], sewakPrice: Number(newPrice) };
            cat.combos = combos;
            updated[catIdx] = cat;
            return updated;
        });
    };

    const updateComboName = (catIdx, comboIdx, newName) => {
        setCategories(prev => {
            const updated = [...prev];
            const cat = { ...updated[catIdx] };
            const combos = [...(cat.combos || [])];
            combos[comboIdx] = { ...combos[comboIdx], name: newName };
            cat.combos = combos;
            updated[catIdx] = cat;
            return updated;
        });
    };

    const addMasterCombo = (catIdx) => {
        const updated = [...categories];
        if (!updated[catIdx].combos) updated[catIdx].combos = [];
        updated[catIdx].combos.push({
            name: "New Combo Pack",
            description: "Value bundle for customers",
            services: [],
            sewakPrice: 0
        });
        setCategories(updated);
    };

    const removeMasterCombo = (catIdx, comboIdx) => {
        const updated = [...categories];
        updated[catIdx].combos.splice(comboIdx, 1);
        setCategories(updated);
    };

    const toggleComboService = (catIdx, comboIdx, serviceName) => {
        const updated = [...categories];
        const combo = updated[catIdx].combos[comboIdx];
        if (!combo.services) combo.services = [];

        if (combo.services.includes(serviceName)) {
            combo.services = combo.services.filter(s => s !== serviceName);
        } else {
            combo.services.push(serviceName);
        }
        setCategories(updated);
    };

    const handleSaveCategoryPricing = async (category) => {
        setSavingId(category._id);

        let updatedServices = category.services;
        
        // If drawer is open, merge the latest selectedService into the category's services array
        if (selectedService && selectedCatIdx !== null && categories[selectedCatIdx]._id === category._id) {
            updatedServices = category.services.map(s => {
                if (s._id === selectedService._id) {
                    return { ...s, basePrice: Number(selectedService.basePrice) || 0 };
                }
                return s;
            });
        }

        try {
            await API.put(`/admin/categories/${category._id}`, {
                services: updatedServices,
                combos: category.combos || []
            });
            toast({ title: "Pricing Updated", description: `Charges for ${category.name} updated successfully.` });
        } catch (err) {
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setSavingId(null);
        }
    };

    const filteredCategories = categories.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = useMemo(() => {
        let totalServices = 0;
        let totalCombos = 0;
        categories.forEach(c => {
            totalServices += (c.services?.length || 0);
            totalCombos += (c.combos?.length || 0);
        });
        return { categories: categories.length, services: totalServices, combos: totalCombos };
    }, [categories]);

    if (loading) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading Price Control...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Sewak Pricing Control</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage global standard rates for internal RozSewa Employees.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Categories", value: stats.categories, icon: Briefcase, cls: "text-gray-700 bg-gray-50 border-gray-200" },
                    { label: "Total Services", value: stats.services, icon: Tag, cls: "text-blue-700 bg-blue-50 border-blue-200" },
                    { label: "Managed Combos", value: stats.combos, icon: Gift, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { label: "Control Status", value: "Active", icon: Shield, cls: "text-purple-700 bg-purple-50 border-purple-200" },
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
            <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch lg:items-center">
                <div className="relative w-full lg:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm transition-all"
                        placeholder="Search categories..."
                    />
                </div>
            </div>

            {/* Accordion List for Categories */}
            <div className="space-y-4">
                {filteredCategories.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-200">
                        <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-bold text-gray-500">No categories found matching your search.</p>
                    </div>
                ) : (
                    filteredCategories.map((cat, filteredIdx) => {
                        const catIdx = categories.findIndex(c => c._id === cat._id);
                        const isExpanded = expandedCatId === cat._id;

                        return (
                            <motion.div
                                key={cat._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: filteredIdx * 0.05 }}
                                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                            >
                                {/* Accordion Header */}
                                <div 
                                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                    onClick={() => setExpandedCatId(isExpanded ? null : cat._id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-gray-100 text-gray-500'}`}>
                                            <Briefcase className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-gray-900 tracking-tight">{cat.name}</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                {cat.services?.length || 0} Services • {cat.combos?.length || 0} Combos
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 sm:mt-0 flex items-center gap-3 w-full sm:w-auto">
                                        <Button
                                            disabled={savingId === cat._id}
                                            onClick={(e) => { e.stopPropagation(); handleSaveCategoryPricing(cat); }}
                                            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 h-10 font-bold uppercase text-[10px] tracking-widest shadow-sm active:scale-95 transition-all flex-1 sm:flex-none"
                                        >
                                            {savingId === cat._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" /> Push Updates</>}
                                        </Button>
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center border border-gray-200 bg-white text-gray-400 shrink-0">
                                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion Body */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-gray-100"
                                        >
                                            <div className="p-6 space-y-8">
                                                {/* Services Section */}
                                                <div>
                                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Tag className="h-4 w-4" /> Standard Services Pricing</h4>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                        {(!cat.services || cat.services.length === 0) ? (
                                                            <div className="col-span-full text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                                <p className="text-[10px] font-bold text-gray-400 italic">No individual services in this category.</p>
                                                            </div>
                                                        ) : cat.services.map((svc, svcIdx) => (
                                                            <div key={svcIdx} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
                                                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                                                    <div className="h-8 w-8 rounded-lg bg-gray-50 text-gray-500 border border-gray-100 flex items-center justify-center font-black text-[10px] shrink-0">
                                                                        {svcIdx + 1}
                                                                    </div>
                                                                    <div className="truncate">
                                                                        <h4 className="text-xs font-black text-gray-800 tracking-tight truncate">{svc.name}</h4>
                                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">Base: ₹{svc.basePrice ?? 0}</p>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setSelectedService(svc);
                                                                        setSelectedCatIdx(catIdx);
                                                                        setSelectedSvcIdx(svcIdx);
                                                                        setShowDrawer(true);
                                                                    }}
                                                                    className="shrink-0 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-bold text-[10px] px-3"
                                                                >
                                                                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Combos Section */}
                                                <div className="pt-6 border-t border-gray-100">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><Gift className="h-4 w-4" /> Discounted Combos</h4>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => addMasterCombo(catIdx)}
                                                            className="rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 h-8 font-black uppercase text-[9px] tracking-widest"
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> Add Combo
                                                        </Button>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-4">
                                                        {(!cat.combos || cat.combos.length === 0) ? (
                                                            <div className="text-center py-8 bg-emerald-50/30 rounded-xl border border-dashed border-emerald-100">
                                                                <p className="text-[10px] font-bold text-emerald-600/60 italic">No master combos defined. Create one to standardise Sewak offerings.</p>
                                                            </div>
                                                        ) : cat.combos.map((combo, comboIdx) => (
                                                            <div key={comboIdx} className="bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100/50 hover:border-emerald-200 transition-colors">
                                                                <div className="flex flex-col md:flex-row gap-5">
                                                                    <div className="flex-1 space-y-4">
                                                                        <InputField label="Combo Name">
                                                                            <input
                                                                                type="text"
                                                                                value={combo.name}
                                                                                onChange={(e) => updateComboName(catIdx, comboIdx, e.target.value)}
                                                                                className={`${inputCls} focus:ring-emerald-500/20 focus:border-emerald-500`}
                                                                                placeholder="e.g. Full Home Service Pack"
                                                                            />
                                                                        </InputField>
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Included Services</label>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {cat.services?.map((svc, i) => {
                                                                                    const isSelected = combo.services?.includes(svc.name);
                                                                                    return (
                                                                                        <button
                                                                                            key={i}
                                                                                            onClick={() => toggleComboService(catIdx, comboIdx, svc.name)}
                                                                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${isSelected
                                                                                                ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                                                                                                : "bg-white text-gray-400 border-gray-200 hover:border-emerald-300"
                                                                                                }`}
                                                                                        >
                                                                                            {isSelected && <CheckCircle2 className="h-3 w-3" />}
                                                                                            {svc.name}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-full md:w-56 space-y-4">
                                                                        <InputField label="Combo Sewak Rate (₹)">
                                                                            <div className="relative">
                                                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                                                                                <input
                                                                                    type="number"
                                                                                    value={combo.sewakPrice || 0}
                                                                                    onChange={(e) => updateComboPrice(catIdx, comboIdx, e.target.value)}
                                                                                    className={`${inputCls} pl-9 font-black text-emerald-700 bg-emerald-50/50 border-emerald-200 focus:ring-emerald-500/20 focus:border-emerald-500`}
                                                                                />
                                                                            </div>
                                                                        </InputField>
                                                                        <Button
                                                                            variant="ghost"
                                                                            onClick={() => removeMasterCombo(catIdx, comboIdx)}
                                                                            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl h-11 font-bold text-[10px] uppercase"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove Combo
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Price Edit Drawer Modal */}
            <AnimatePresence>
                {showDrawer && selectedService && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDrawer(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-screen w-full max-w-sm bg-white shadow-2xl z-[101] flex flex-col"
                        >
                            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
                                <div>
                                    <h3 className="text-lg font-black tracking-tight text-gray-900">Edit Price</h3>
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{categories[selectedCatIdx]?.name}</p>
                                </div>
                                <button onClick={() => setShowDrawer(false)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30">
                                {/* Service Info */}
                                <div className="space-y-1">
                                    <h4 className="text-xl font-black text-gray-900 leading-tight">{selectedService.name}</h4>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">ID: {selectedService._id}</p>
                                </div>

                                {/* Pricing Input */}
                                <div className="space-y-4">
                                    <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
                                        <InputField label="Standard Service Rate (₹)">
                                            <div className="relative mt-2">
                                                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                <input
                                                    type="number"
                                                    value={selectedService.basePrice || 0}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        updatePrice(selectedCatIdx, selectedSvcIdx, 'basePrice', val);
                                                        setSelectedService(prev => ({ ...prev, basePrice: val }));
                                                    }}
                                                    className="w-full h-14 pl-11 rounded-xl border border-gray-200 bg-gray-50 font-black text-2xl text-gray-900 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                                />
                                            </div>
                                        </InputField>
                                        <p className="text-[10px] font-medium text-gray-400 mt-3 flex items-start gap-1.5 leading-relaxed">
                                            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
                                            This base price applies to all Sewaks offering this service globally. Make sure to hit 'Save Changes' below.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 border-t border-gray-100 bg-white">
                                <Button
                                    onClick={() => {
                                        handleSaveCategoryPricing(categories[selectedCatIdx]);
                                        setShowDrawer(false);
                                    }}
                                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-sm transition-all"
                                >
                                    Confirm & Save Changes
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SewakPricing;
