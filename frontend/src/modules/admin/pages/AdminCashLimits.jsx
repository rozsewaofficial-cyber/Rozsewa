import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import API from '../../../lib/api';
import { useToast } from '../../../hooks/use-toast';
import { Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
const AdminCashLimits = () => {
    const { setTitle } = useOutletContext();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [config, setConfig] = useState({
        defaultLimit: 1500,
        categoryLimits: [],
        serviceLimits: []
    });

    const [categories, setCategories] = useState([]);
    const [services, setServices] = useState([]);

    useEffect(() => {
        setTitle("Cash Limits");
        fetchData();
    }, [setTitle]);

    const fetchData = async () => {
        try {
            const [cfgRes, catRes] = await Promise.all([
                API.get('/admin/settings/cash-limits'),
                API.get('/admin/categories')
            ]);
            
            setConfig({
                defaultLimit: cfgRes.data.defaultLimit || 1500,
                categoryLimits: cfgRes.data.categoryLimits || [],
                serviceLimits: cfgRes.data.serviceLimits || []
            });
            
            setCategories(catRes.data);
            
            // Extract services directly from categories since there is no separate /services endpoint
            let allServices = [];
            catRes.data.forEach(cat => {
                if (cat.services && Array.isArray(cat.services)) {
                    cat.services.forEach(srv => {
                        allServices.push({
                            _id: srv._id,
                            name: srv.name,
                            category: { name: cat.name }
                        });
                    });
                }
            });
            setServices(allServices);

            setLoading(false);
        } catch (error) {
            console.error('Error fetching cash limits:', error);
            toast({ title: 'Failed to fetch data', variant: 'destructive' });
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (config.categoryLimits.some(c => !c.categoryId)) {
            toast({ title: 'Validation Error', description: 'Please select a category for all Category Overrides.', variant: 'destructive' });
            return;
        }
        if (config.serviceLimits.some(s => !s.serviceId)) {
            toast({ title: 'Validation Error', description: 'Please select a service for all Service Overrides.', variant: 'destructive' });
            return;
        }

        setSaving(true);
        try {
            await API.put('/admin/settings/cash-limits', config);
            toast({ title: 'Cash Limits Updated!', description: 'Your changes have been saved.' });
        } catch (error) {
            console.error('Error saving cash limits:', error);
            toast({ title: 'Failed to update', description: error.response?.data?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const addCategoryLimit = () => {
        if (config.categoryLimits.some(c => !c.categoryId)) {
            toast({ title: 'Validation Error', description: 'Please select a category for the current override before adding a new one.', variant: 'destructive' });
            return;
        }
        setConfig({
            ...config,
            categoryLimits: [...config.categoryLimits, { categoryId: '', limit: 2000 }]
        });
    };

    const removeCategoryLimit = (index) => {
        const newArr = [...config.categoryLimits];
        newArr.splice(index, 1);
        setConfig({ ...config, categoryLimits: newArr });
    };

    const updateCategoryLimit = (index, field, value) => {
        const newArr = [...config.categoryLimits];
        newArr[index][field] = value;
        setConfig({ ...config, categoryLimits: newArr });
    };

    const addServiceLimit = () => {
        if (config.serviceLimits.some(s => !s.serviceId)) {
            toast({ title: 'Validation Error', description: 'Please select a service for the current override before adding a new one.', variant: 'destructive' });
            return;
        }
        setConfig({
            ...config,
            serviceLimits: [...config.serviceLimits, { serviceId: '', limit: 2500 }]
        });
    };

    const removeServiceLimit = (index) => {
        const newArr = [...config.serviceLimits];
        newArr.splice(index, 1);
        setConfig({ ...config, serviceLimits: newArr });
    };

    const updateServiceLimit = (index, field, value) => {
        const newArr = [...config.serviceLimits];
        newArr[index][field] = value;
        setConfig({ ...config, serviceLimits: newArr });
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
                <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 font-bold text-muted-foreground animate-pulse tracking-widest text-xs uppercase">Loading Limits...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Configuration</h2>
                    <p className="mt-1 text-sm text-gray-500 font-medium">Manage global and specific debt limits.</p>
                </div>
                <button
                    onClick={handleSave} 
                    disabled={saving}
                    className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save Configuration</>}
                </button>
            </div>

            <main className="space-y-6">
                {/* Header info */}
                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                    <h2 className="text-lg font-black text-blue-800 flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5" /> How this works
                    </h2>
                    <p className="text-blue-700/80 text-sm font-medium leading-relaxed">
                        The Cash Limit defines the maximum "debt" (negative wallet balance) a provider can have before the system blocks them from accepting new bookings. 
                        You can set a global limit, override it for specific Provider Categories (e.g. Electricians have higher limits), or override it for specific Services.
                        The system checks: <b>Service Override &gt; Category Override &gt; Global Default</b>.
                    </p>
                </div>

                {/* Global Default */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-xl font-black tracking-tight mb-6 flex items-center gap-2">
                        Global Default Limit
                    </h3>
                    <div className="max-w-xs">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Maximum Debt (₹)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">₹</span>
                            <input 
                                type="number" 
                                min="0"
                                value={config.defaultLimit}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    if (val !== '' && Number(val) < 0) val = 0;
                                    setConfig({ ...config, defaultLimit: val });
                                }}
                                className="w-full h-14 pl-8 pr-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none font-black text-xl text-gray-900"
                            />
                        </div>
                    </div>
                </section>

                {/* Category Overrides */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black tracking-tight">Category Overrides</h3>
                        <button onClick={addCategoryLimit} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Category
                        </button>
                    </div>

                    {config.categoryLimits.length === 0 ? (
                        <p className="text-sm font-medium text-muted-foreground py-4 text-center border-2 border-dashed rounded-xl">No category overrides set.</p>
                    ) : (
                        <div className="space-y-4">
                            {config.categoryLimits.map((catLim, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Select Category</label>
                                        <select 
                                            value={catLim.categoryId} 
                                            onChange={(e) => updateCategoryLimit(index, 'categoryId', e.target.value)}
                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-sm text-gray-900"
                                        >
                                            <option value="">-- Choose Category --</option>
                                            {categories.map(c => (
                                                <option key={c._id} value={c._id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-full md:w-48">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Max Debt (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">₹</span>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={catLim.limit}
                                                onChange={(e) => {
                                                    let val = e.target.value;
                                                    if (val !== '' && Number(val) < 0) val = 0;
                                                    updateCategoryLimit(index, 'limit', val);
                                                }}
                                                className="w-full h-12 pl-7 pr-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-sm text-gray-900"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full md:w-auto flex justify-end md:mt-6">
                                        <button onClick={() => removeCategoryLimit(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Service Overrides */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black tracking-tight">Service Overrides</h3>
                        <button onClick={addServiceLimit} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Service
                        </button>
                    </div>

                    {config.serviceLimits.length === 0 ? (
                        <p className="text-sm font-medium text-muted-foreground py-4 text-center border-2 border-dashed rounded-xl">No service overrides set.</p>
                    ) : (
                        <div className="space-y-4">
                            {config.serviceLimits.map((srvLim, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex-1 w-full">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Select Service</label>
                                        <select 
                                            value={srvLim.serviceId} 
                                            onChange={(e) => updateServiceLimit(index, 'serviceId', e.target.value)}
                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-sm text-gray-900"
                                        >
                                            <option value="">-- Choose Service --</option>
                                            {services.map(s => (
                                                <option key={s._id} value={s._id}>{s.name} ({s.category?.name})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-full md:w-48">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Max Debt (₹)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">₹</span>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={srvLim.limit}
                                                onChange={(e) => {
                                                    let val = e.target.value;
                                                    if (val !== '' && Number(val) < 0) val = 0;
                                                    updateServiceLimit(index, 'limit', val);
                                                }}
                                                className="w-full h-12 pl-7 pr-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-bold text-sm text-gray-900"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full md:w-auto flex justify-end md:mt-6">
                                        <button onClick={() => removeServiceLimit(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default AdminCashLimits;
