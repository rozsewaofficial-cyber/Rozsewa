import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
    IndianRupee, Save, Loader2, Search, Briefcase,
    ChevronRight, AlertCircle, TrendingUp, Info, Zap,
    Plus, Trash2, Gift, CheckCircle2, X, Tag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SewakPricing = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [savingId, setSavingId] = useState(null);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedCatIdx, setSelectedCatIdx] = useState(null);
    const [selectedSvcIdx, setSelectedSvcIdx] = useState(null);
    const [showDrawer, setShowDrawer] = useState(false);

    useEffect(() => {
        setTitle("Sewak Pricing Control");
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
        
        // Merge the latest selectedService into the category's services array
        const updatedServices = category.services.map(s => {
            if (s._id === selectedService?._id) {
                return {
                    ...s,
                    sewakPriceBasic: Number(selectedService.sewakPriceBasic) || 0,
                    sewakPriceStandard: Number(selectedService.sewakPriceStandard) || 0,
                    sewakPricePremium: Number(selectedService.sewakPricePremium) || 0,
                    sewakPriceExpress: Number(selectedService.sewakPriceExpress) || 0
                };
            }
            return s;
        });

        // Debug toast
        toast({
            title: "Saving Data",
            description: `Basic Price: ${updatedServices.find(s => s._id === selectedService?._id)?.sewakPriceBasic}`
        });

        try {
            await API.put(`/admin/categories/${category._id}`, {
                services: updatedServices,
                combos: category.combos || []
            });
            toast({
                title: "Pricing Updated",
                description: `Charges for ${category.name} have been updated for all Sewaks.`
            });
        } catch (err) {
            toast({ title: "Update Failed", variant: "destructive" });
        } finally {
            setSavingId(null);
        }
    };

    const filteredCategories = (categories || []).filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex h-96 flex-col items-center justify-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Loading Price Control...</p>
        </div>
    );

    return (
        <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500">

            {/* Hero Header */}
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 md:p-8 text-white shadow-xl">
                <div className="relative z-10 space-y-2 max-w-2xl text-left">
                    <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                        <TrendingUp className="h-3 w-3 text-emerald-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Admin Managed Rates</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                        Sewak Service Charges
                    </h1>
                    <p className="text-slate-400 font-bold text-[11px] md:text-xs opacity-90 leading-relaxed">
                        Configure global standard rates for internal RozSewa Employees (Sewaks).
                    </p>
                </div>

                {/* Abstract Background Design */}
                <div className="absolute top-0 right-0 h-full w-1/2 opacity-10 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full border-[40px] border-white" />
                    <div className="absolute bottom-[-10%] left-[20%] w-[200px] h-[200px] rounded-full border-[20px] border-white" />
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full rounded-2xl border-2 border-gray-50 bg-gray-50/50 py-4 pl-12 pr-4 text-sm font-bold placeholder:text-gray-400 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all"
                        placeholder="Search categories..."
                    />
                </div>
                <div className="flex items-center gap-3 bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100/50">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-black text-blue-700 uppercase tracking-tighter">Centralized Control Active</span>
                </div>
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-1 gap-8">
                {filteredCategories.map((cat, filteredIdx) => {
                    const catIdx = categories.findIndex(c => c._id === cat._id);
                    return (
                        <motion.div
                            key={cat._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: filteredIdx * 0.1 }}
                        >
                        <Card className="rounded-[2.5rem] border-0 shadow-xl shadow-gray-200/50 overflow-hidden group">
                            <CardHeader className="bg-white border-b border-gray-50 p-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                                            <Briefcase className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">{cat.name}</CardTitle>
                                            <CardDescription className="font-bold text-gray-400 text-xs mt-0.5">{cat.services?.length || 0} Managed Services</CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        disabled={savingId === cat._id}
                                        onClick={() => handleSaveCategoryPricing(cat)}
                                        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-[0.95] transition-all"
                                    >
                                        {savingId === cat._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Push Updates</>}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-4 bg-gray-50/20">
                                <div className="grid grid-cols-1 gap-4">
                                    {cat.services?.map((svc, svcIdx) => (
                                        <div
                                            key={svcIdx}
                                            className="flex items-center justify-between bg-white p-5 rounded-[1.5rem] border border-gray-100 hover:border-blue-100 hover:shadow-sm transition-all group/row text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                                                    {svcIdx + 1}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-gray-800 tracking-tight">{svc.name}</h4>
                                                    <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">
                                                        ID: {svc._id?.slice(-6)} • Basic: ₹{svc.sewakPriceBasic ?? svc.basePrice}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button 
                                                variant="ghost" 
                                                onClick={() => {
                                                    setSelectedService(svc);
                                                    setSelectedCatIdx(catIdx);
                                                    setSelectedSvcIdx(svcIdx);
                                                    setShowDrawer(true);
                                                }}
                                                className="group/btn flex items-center gap-2 rounded-xl border border-gray-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 px-4 py-2 text-[10px] font-black transition-all"
                                            >
                                                View Details
                                                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                            </Button>
                                        </div>
                                    ))}

                                    {(!cat.services || cat.services.length === 0) && (
                                        <div className="text-center py-12 bg-white rounded-[2rem] border-2 border-dashed border-gray-100">
                                            <Info className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-gray-400 italic">No individual services in this category.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Combos Section */}
                                <div className="mt-12 pt-8 border-t border-gray-100">
                                    <div className="flex items-center justify-between mb-6 ml-2">
                                        <div className="flex items-center gap-2">
                                            <Gift className="h-5 w-5 text-emerald-600" />
                                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Standard Discounted Combos</h3>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addMasterCombo(catIdx)}
                                            className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 h-9 font-black uppercase text-[9px] tracking-widest"
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Add New Combo Template
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {cat.combos?.map((combo, comboIdx) => (
                                            <div
                                                key={comboIdx}
                                                className="flex flex-col gap-6 bg-emerald-50/20 p-6 rounded-[2rem] border border-emerald-100/50 hover:border-emerald-200 hover:shadow-md transition-all group/row text-left"
                                            >
                                                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Combo Name</label>
                                                            <Input
                                                                value={combo.name}
                                                                onChange={(e) => {
                                                                    const updated = [...categories];
                                                                    updated[catIdx].combos[comboIdx].name = e.target.value;
                                                                    setCategories(updated);
                                                                }}
                                                                className="h-11 rounded-xl border-gray-100 bg-white font-black text-sm focus:ring-emerald-500/10 focus:border-emerald-500"
                                                                placeholder="e.g. Full Home Service Pack"
                                                            />
                                                        </div>

                                                        <div className="space-y-3">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Included Services</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {cat.services?.map((svc, i) => {
                                                                    const isSelected = combo.services?.includes(svc.name);
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            onClick={() => toggleComboService(catIdx, comboIdx, svc.name)}
                                                                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${isSelected
                                                                                ? "bg-emerald-600 text-white border-emerald-700 shadow-md"
                                                                                : "bg-white text-slate-400 border-slate-100 hover:border-emerald-200"
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

                                                    <div className="w-full lg:w-48 space-y-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 ml-1">Combo Sewak Rate ₹</label>
                                                            <div className="relative group/input">
                                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2"><IndianRupee className="h-3 w-3 text-emerald-600" /></div>
                                                                <Input
                                                                    type="number"
                                                                    value={combo.sewakPrice || 0}
                                                                    onChange={(e) => updateComboPrice(catIdx, comboIdx, e.target.value)}
                                                                    className="w-full h-11 pl-8 rounded-xl border-emerald-200 bg-white font-black text-xs focus:ring-emerald-500/10 focus:border-emerald-500"
                                                                />
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeMasterCombo(catIdx, comboIdx)}
                                                            className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-10 font-bold text-[10px] uppercase"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove Combo
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {(!cat.combos || cat.combos.length === 0) && (
                                            <div className="text-center py-10 bg-white/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                                                <Gift className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-[10px] font-bold text-gray-400 italic">No master combos defined. Create one to standardise Sewak offerings.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        </motion.div>
                    );
                })}
            </div>

            {/* Details Drawer */}
            <AnimatePresence>
                {showDrawer && selectedService && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDrawer(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100]"
                        />
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                        <IndianRupee className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black tracking-tight">Pricing Details</h3>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{categories[selectedCatIdx]?.name}</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setShowDrawer(false)} className="rounded-xl hover:bg-white/10 text-white">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {/* Service Info */}
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-blue-600 border border-blue-100 mb-2">
                                        <Tag className="h-3 w-3" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Service Profile</span>
                                    </div>
                                    <h4 className="text-2xl font-black text-gray-900 leading-tight">{selectedService.name}</h4>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Master ID: {selectedService._id}</p>
                                </div>

                                {/* Pricing Tiers */}
                                <div className="space-y-6">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 border-b border-gray-50 pb-2 flex items-center gap-2">
                                        <Zap className="h-3 w-3 text-amber-500" /> Standard Tiers
                                    </h5>
                                    
                                    <div className="grid grid-cols-1 gap-4">
                                        {[
                                            { key: 'sewakPriceBasic', label: 'Basic Tier', color: 'emerald', icon: IndianRupee },
                                            { key: 'sewakPriceStandard', label: 'Standard Tier', color: 'blue', icon: IndianRupee },
                                            { key: 'sewakPricePremium', label: 'Premium Tier', color: 'purple', icon: IndianRupee },
                                            { key: 'sewakPriceExpress', label: 'Express Tier', color: 'amber', icon: Zap }
                                        ].map((tier) => (
                                            <div key={tier.key} className={`p-4 rounded-2xl border transition-all ${tier.color === 'emerald' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-gray-50/50 border-gray-100'}`}>
                                                <div className="flex items-center justify-between mb-3 px-1">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">{tier.label}</label>
                                                    <tier.icon className={`h-3 w-3 text-${tier.color}-500`} />
                                                </div>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">₹</div>
                                                    <Input
                                                        type="number"
                                                        value={selectedService[tier.key] ?? (tier.key === 'sewakPriceBasic' ? selectedService.basePrice : 0)}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            updatePrice(selectedCatIdx, selectedSvcIdx, tier.key, val);
                                                            setSelectedService(prev => ({ ...prev, [tier.key]: val }));
                                                        }}
                                                        className="h-12 pl-10 rounded-xl border-gray-200 bg-white font-black text-sm focus:ring-blue-500/10 focus:border-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Summary Card */}
                                <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-4 shadow-xl">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Variations</p>
                                        <p className="text-xs font-black text-emerald-400">4 ACTIVE TIERS</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Starting From</p>
                                            <h3 className="text-3xl font-black">₹{selectedService.sewakPriceBasic ?? selectedService.basePrice}</h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                                <Button 
                                    onClick={() => handleSaveCategoryPricing(categories[selectedCatIdx])}
                                    disabled={savingId === categories[selectedCatIdx]?._id}
                                    className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-gray-200 transition-all active:scale-[0.98]"
                                >
                                    {savingId === categories[selectedCatIdx]?._id ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        "Save All Changes"
                                    )}
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
