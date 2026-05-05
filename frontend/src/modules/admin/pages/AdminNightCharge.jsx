import React, { useState, useEffect } from 'react';
import { useOutletContext } from "react-router-dom";
import { 
    Moon, Sun, Percent, Save, RefreshCw, 
    ChevronRight, Loader2, AlertCircle, 
    Clock, CheckCircle2, LayoutGrid, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import API from "@/lib/api";

const AdminNightCharge = () => {
    const { setTitle } = useOutletContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [globalConfig, setGlobalConfig] = useState({
        enabled: false,
        defaultPercent: 0,
        startTime: '21:00',
        endTime: '06:00'
    });
    const [categories, setCategories] = useState([]);
    const [editingCategory, setEditingCategory] = useState(null);

    useEffect(() => {
        setTitle("Night Charge Management");
        fetchSettings();
    }, [setTitle]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/admin/night-charge');
            setGlobalConfig(data.global);
            setCategories(data.categories);
        } catch (error) {
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalSave = async () => {
        setSaving(true);
        try {
            await API.post('/admin/night-charge/global', globalConfig);
            toast.success("Global settings updated successfully");
        } catch (error) {
            toast.error("Failed to update global settings");
        } finally {
            setSaving(false);
        }
    };

    const handleApplyAll = async () => {
        if (!window.confirm("Are you sure you want to apply global settings to all categories? This will overwrite individual settings.")) return;
        
        setSaving(true);
        try {
            await API.post('/admin/night-charge/apply-all');
            await fetchSettings();
            toast.success("Applied to all categories successfully");
        } catch (error) {
            toast.error("Failed to apply settings");
        } finally {
            setSaving(false);
        }
    };

    const handleCategoryUpdate = async (id, hasNightCharge, nightChargePercent) => {
        try {
            const { data } = await API.put(`/admin/night-charge/category/${id}`, {
                hasNightCharge,
                nightChargePercent
            });
            setCategories(prev => prev.map(cat => cat._id === id ? data : cat));
            toast.success("Category updated");
            setEditingCategory(null);
        } catch (error) {
            toast.error("Failed to update category");
        }
    };

    if (loading) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 opacity-50" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-5 md:p-8 text-white shadow-2xl">
                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="inline-flex items-center gap-1.5 bg-blue-500/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                        <Moon className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Convenience Logic</span>
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-none">
                            Night Charge Config
                        </h1>
                        <p className="text-slate-400 font-bold text-xs md:text-sm opacity-80 leading-relaxed max-w-xl">
                            Manage additional convenience charges for night-time services across providers.
                        </p>
                    </div>
                </div>

                <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 pointer-events-none hidden md:block">
                    <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full border-[16px] border-white/20" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Global Settings Panel */}
                <Card className="lg:col-span-1 rounded-[2.5rem] border-0 shadow-2xl bg-white overflow-hidden">
                    <div className="bg-slate-50 p-8 border-b border-gray-100">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Global Controls</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Primary Settings</p>
                    </div>
                    <CardContent className="p-8 space-y-8">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                                <p className="font-black text-slate-900">Enable Night Charges</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Apply globally</p>
                            </div>
                            <Switch 
                                checked={globalConfig.enabled}
                                onCheckedChange={(val) => setGlobalConfig(prev => ({ ...prev, enabled: val }))}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Default Percentage (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input 
                                    type="number"
                                    value={globalConfig.defaultPercent}
                                    onChange={(e) => setGlobalConfig(prev => ({ ...prev, defaultPercent: Number(e.target.value) }))}
                                    className="pl-11 rounded-2xl border-gray-100 bg-gray-50/50 h-14 text-sm font-black"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Time</label>
                                <div className="flex items-center gap-3 bg-slate-50/50 rounded-xl border border-slate-100 px-4 h-12 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all group">
                                    <Clock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none shrink-0" />
                                    <Input 
                                        type="time"
                                        value={globalConfig.startTime}
                                        onChange={(e) => setGlobalConfig(prev => ({ ...prev, startTime: e.target.value }))}
                                        className="border-0 bg-transparent h-full w-full p-0 text-sm font-black focus-visible:ring-0 shadow-none"
                                        style={{ colorScheme: 'light' }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">End Time</label>
                                <div className="flex items-center gap-3 bg-slate-50/50 rounded-xl border border-slate-100 px-4 h-12 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 transition-all group">
                                    <Clock className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none shrink-0" />
                                    <Input 
                                        type="time"
                                        value={globalConfig.endTime}
                                        onChange={(e) => setGlobalConfig(prev => ({ ...prev, endTime: e.target.value }))}
                                        className="border-0 bg-transparent h-full w-full p-0 text-sm font-black focus-visible:ring-0 shadow-none"
                                        style={{ colorScheme: 'light' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Button 
                                onClick={handleGlobalSave}
                                disabled={saving}
                                className="w-full rounded-xl h-12 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Update Global Settings
                            </Button>
                            
                            <Button 
                                variant="outline"
                                onClick={handleApplyAll}
                                disabled={saving}
                                className="w-full rounded-xl h-12 border-blue-100 bg-blue-50/30 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:bg-blue-50 hover:border-blue-200 transition-all"
                            >
                                <Zap className="h-4 w-4 mr-2" /> Apply to All Categories
                            </Button>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                                Note: Categories with individual settings will be overwritten if you click "Apply to All". Use with caution.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Category List Panel */}
                <Card className="lg:col-span-2 rounded-[2.5rem] border-0 shadow-2xl bg-white overflow-hidden">
                    <div className="bg-slate-50 p-8 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Category Overrides</h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Specific Controls</p>
                        </div>
                        <div className="h-10 w-10 bg-white rounded-xl border border-gray-100 flex items-center justify-center text-xs font-black text-slate-400">
                            {categories.length}
                        </div>
                    </div>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-50">
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Service Category</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Night Charge (%)</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {categories.map((cat) => (
                                        <tr key={cat._id} className="hover:bg-blue-50/20 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-[10px] border border-white shadow-sm">
                                                        {cat.name.charAt(0)}
                                                    </div>
                                                    <p className="font-black text-gray-900 tracking-tight text-sm">{cat.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <Switch 
                                                        checked={cat.hasNightCharge}
                                                        onCheckedChange={(val) => handleCategoryUpdate(cat._id, val, cat.nightChargePercent)}
                                                    />
                                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${cat.hasNightCharge ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                        {cat.hasNightCharge ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {editingCategory === cat._id ? (
                                                    <div className="flex items-center gap-2 max-w-[100px]">
                                                        <Input 
                                                            type="number"
                                                            defaultValue={cat.nightChargePercent}
                                                            onBlur={(e) => handleCategoryUpdate(cat._id, cat.hasNightCharge, Number(e.target.value))}
                                                            className="h-8 rounded-lg font-black text-xs px-2"
                                                            autoFocus
                                                        />
                                                        <span className="text-xs font-black text-gray-400">%</span>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onClick={() => setEditingCategory(cat._id)}
                                                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg cursor-pointer hover:bg-blue-600 hover:text-white transition-all group/val"
                                                    >
                                                        <span className="text-xs font-black">{cat.nightChargePercent}</span>
                                                        <span className="text-[10px] font-bold opacity-50 group-hover/val:opacity-100">%</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => setEditingCategory(cat._id === editingCategory ? null : cat._id)}
                                                    className="h-9 w-9 rounded-xl hover:bg-slate-900 hover:text-white transition-all"
                                                >
                                                    <RefreshCw className={`h-4 w-4 ${editingCategory === cat._id ? 'animate-spin' : ''}`} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminNightCharge;
