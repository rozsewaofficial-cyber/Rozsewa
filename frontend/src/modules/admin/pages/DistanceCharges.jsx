import React, { useState, useEffect } from 'react';
import API from '../../../lib/api';
import { toast } from 'sonner';
import { Save, RefreshCw, AlertCircle, MapPin } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

const DistanceCharges = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('global');
    const [resetAllOverrides, setResetAllOverrides] = useState(false);

    const [config, setConfig] = useState({
        enabled: true,
        baseDistance: 3,
        baseFee: 40,
        extraFeePerKm: 10,
        maximumDistance: '',
        maximumCharge: '',
        rounding: 'nearest',
        calculationMethod: 'haversine',
        fallbackCharge: 40,
        categoryOverrides: {}
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [cfgRes, catRes] = await Promise.all([
                API.get('/admin/distance-charge'),
                API.get('/admin/categories')
            ]);

            const data = cfgRes.data;
            setConfig({
                enabled: data.enabled !== undefined ? data.enabled : true,
                baseDistance: data.baseDistance || 3,
                baseFee: data.baseFee || 40,
                extraFeePerKm: data.extraFeePerKm || 10,
                maximumDistance: data.maximumDistance || '',
                maximumCharge: data.maximumCharge || '',
                rounding: data.rounding || 'nearest',
                calculationMethod: data.calculationMethod || 'haversine',
                fallbackCharge: data.fallbackCharge || 40,
                categoryOverrides: data.categoryOverrides || {}
            });
            setCategories(catRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load distance charge settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = JSON.parse(JSON.stringify(config)); // deep copy
            
            // convert empty strings to null for optional numbers
            if (payload.maximumDistance === '') payload.maximumDistance = null;
            if (payload.maximumCharge === '') payload.maximumCharge = null;
            
            if (payload.categoryOverrides) {
                Object.keys(payload.categoryOverrides).forEach(catId => {
                    if (payload.categoryOverrides[catId].maximumDistance === '') payload.categoryOverrides[catId].maximumDistance = null;
                    if (payload.categoryOverrides[catId].maximumCharge === '') payload.categoryOverrides[catId].maximumCharge = null;
                });
            }

            if (selectedCategory === 'global' && resetAllOverrides) {
                payload.categoryOverrides = {};
            }

            await API.put('/admin/distance-charge', payload);
            if (selectedCategory === 'global' && resetAllOverrides) {
                setConfig(payload);
                setResetAllOverrides(false);
            }
            toast.success('Distance charge settings saved successfully!');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const getCurrentConfig = () => {
        if (selectedCategory === 'global') return config;
        return config.categoryOverrides[selectedCategory] || { 
            enabled: config.enabled,
            baseDistance: config.baseDistance,
            baseFee: config.baseFee,
            extraFeePerKm: config.extraFeePerKm,
            maximumDistance: config.maximumDistance,
            maximumCharge: config.maximumCharge,
            rounding: config.rounding,
            calculationMethod: config.calculationMethod,
            fallbackCharge: config.fallbackCharge
        };
    };

    const updateConfigField = (key, value) => {
        if (selectedCategory === 'global') {
            setConfig(prev => ({ ...prev, [key]: value }));
        } else {
            setConfig(prev => {
                const overrides = { ...prev.categoryOverrides };
                if (!overrides[selectedCategory]) {
                    overrides[selectedCategory] = { 
                        enabled: prev.enabled,
                        baseDistance: prev.baseDistance,
                        baseFee: prev.baseFee,
                        extraFeePerKm: prev.extraFeePerKm,
                        maximumDistance: prev.maximumDistance,
                        maximumCharge: prev.maximumCharge,
                        rounding: prev.rounding,
                        calculationMethod: prev.calculationMethod,
                        fallbackCharge: prev.fallbackCharge
                    };
                }
                overrides[selectedCategory][key] = value;
                return { ...prev, categoryOverrides: overrides };
            });
        }
    };

    const removeCategoryOverride = () => {
        if (selectedCategory !== 'global') {
            setConfig(prev => {
                const overrides = { ...prev.categoryOverrides };
                delete overrides[selectedCategory];
                return { ...prev, categoryOverrides: overrides };
            });
            toast.success("Category override removed. Will use global settings.");
        }
    };

    const currentData = getCurrentConfig();

    if (loading) {
        return (
            <div className="p-6 md:p-8 flex justify-center items-center h-64">
                <RefreshCw className="w-8 h-8 text-[#0275B1] animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-[#0275B1]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Distance-Based Travel Charges</h1>
                        <p className="text-slate-500 text-sm">Configure how much customers are charged for distance</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Label htmlFor="enabled" className="text-slate-700 font-medium">Enable Travel Charges</Label>
                    <Switch
                        id="enabled"
                        checked={currentData.enabled}
                        onCheckedChange={(val) => updateConfigField('enabled', val)}
                    />
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <Label className="text-sm font-semibold mb-2 block text-slate-800">Configuration Target</Label>
                <div className="flex items-center gap-4">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="global" className="font-bold">Global Default</SelectItem>
                            {categories.map(c => (
                                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedCategory !== 'global' && config.categoryOverrides && config.categoryOverrides[selectedCategory] && (
                        <button 
                            onClick={removeCategoryOverride}
                            className="text-red-500 text-sm hover:underline font-medium"
                        >
                            Remove Category Override
                        </button>
                    )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    {selectedCategory === 'global' ? "These settings apply to all categories unless overridden." : "You are currently editing overrides for this specific category."}
                </p>
                {selectedCategory === 'global' && Object.keys(config.categoryOverrides || {}).length > 0 && (
                    <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <input 
                            type="checkbox" 
                            id="resetOverrides" 
                            checked={resetAllOverrides}
                            onChange={(e) => setResetAllOverrides(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded border-red-300 focus:ring-red-500"
                        />
                        <label htmlFor="resetOverrides" className="text-sm text-red-800 font-medium">
                            Overwrite and remove all existing category overrides
                        </label>
                    </div>
                )}
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                    <h2 className="text-lg font-semibold text-slate-800 border-b pb-3">Base Pricing</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <Label>Base Distance (KM)</Label>
                            <Input 
                                type="number" 
                                min="0" step="0.1" 
                                value={currentData.baseDistance} 
                                onChange={(e) => updateConfigField('baseDistance', e.target.value)} 
                                required
                                className="mt-1.5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Distance up to which only the Base Fee applies.</p>
                        </div>
                        
                        <div>
                            <Label>Base Fee (₹)</Label>
                            <Input 
                                type="number" 
                                min="0" 
                                value={currentData.baseFee} 
                                onChange={(e) => updateConfigField('baseFee', e.target.value)} 
                                required
                                className="mt-1.5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Fixed fee charged for distance up to the Base Distance.</p>
                        </div>

                        <div>
                            <Label>Extra Fee per KM (₹)</Label>
                            <Input 
                                type="number" 
                                min="0" 
                                value={currentData.extraFeePerKm} 
                                onChange={(e) => updateConfigField('extraFeePerKm', e.target.value)} 
                                required
                                className="mt-1.5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Amount charged for every kilometer beyond the Base Distance.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                    <h2 className="text-lg font-semibold text-slate-800 border-b pb-3">Limits & Settings</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <Label>Maximum Distance (KM) [Optional]</Label>
                            <Input 
                                type="number" 
                                min="0" step="0.1"
                                placeholder="No limit"
                                value={currentData.maximumDistance || ''} 
                                onChange={(e) => updateConfigField('maximumDistance', e.target.value)} 
                                className="mt-1.5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Cap the billable distance to this value.</p>
                        </div>

                        <div>
                            <Label>Maximum Charge (₹) [Optional]</Label>
                            <Input 
                                type="number" 
                                min="0" 
                                placeholder="No limit"
                                value={currentData.maximumCharge || ''} 
                                onChange={(e) => updateConfigField('maximumCharge', e.target.value)} 
                                className="mt-1.5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Maximum travel charge a customer can incur.</p>
                        </div>

                        <div>
                            <Label>Rounding Method</Label>
                            <Select value={currentData.rounding} onValueChange={(val) => updateConfigField('rounding', val)}>
                                <SelectTrigger className="w-full mt-1.5">
                                    <SelectValue placeholder="Select Rounding" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="nearest">Round to Nearest</SelectItem>
                                    <SelectItem value="up">Round Up</SelectItem>
                                    <SelectItem value="down">Round Down</SelectItem>
                                    <SelectItem value="none">No Rounding (Exact)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Fallback Charge (₹)</Label>
                            <Input 
                                type="number" 
                                min="0" 
                                value={currentData.fallbackCharge} 
                                onChange={(e) => updateConfigField('fallbackCharge', e.target.value)} 
                                required
                                className="mt-1.5"
                            />
                            <p className="text-xs text-slate-500 mt-1">Charge applied if location is unavailable or during estimated broadcast bookings.</p>
                        </div>
                    </div>
                </div>
                
                <div className="lg:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-[#0275B1] text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-[#025a8a] transition-colors"
                    >
                        {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>

            </form>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 items-start">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                    <strong>Note:</strong> 100% of the travel charge is paid directly to the Provider. It is not subject to platform commission. Ensure your partner's commission rules and waiver programs are functioning as expected.
                </div>
            </div>

        </div>
    );
};

export default DistanceCharges;
