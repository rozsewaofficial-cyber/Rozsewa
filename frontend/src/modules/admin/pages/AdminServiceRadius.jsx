import React, { useState, useEffect } from 'react';
import API from '../../../lib/api';
import { toast } from 'sonner';
import { Save, RefreshCw, Navigation, Info } from 'lucide-react';

const AdminServiceRadius = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [limits, setLimits] = useState({ minimumRadius: 1, maximumRadius: 50 });
    const [draft, setDraft] = useState({ minimumRadius: 1, maximumRadius: 50 });

    useEffect(() => {
        fetchLimits();
    }, []);

    const fetchLimits = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/admin/settings/service-radius');
            setLimits(data);
            setDraft(data);
        } catch {
            toast.error('Failed to load service radius settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const min = Number(draft.minimumRadius);
        const max = Number(draft.maximumRadius);
        if (isNaN(min) || min <= 0) { toast.error('Minimum radius must be a positive number.'); return; }
        if (isNaN(max) || max <= min) { toast.error('Maximum radius must be greater than the minimum radius.'); return; }
        setSaving(true);
        try {
            const { data } = await API.put('/admin/settings/service-radius', { minimumRadius: min, maximumRadius: max });
            setLimits(data);
            setDraft(data);
            toast.success('Service radius limits updated successfully.');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Navigation className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                    <h1 className="text-lg font-black text-foreground">Service Radius Settings</h1>
                    <p className="text-xs text-muted-foreground font-medium">Configure the allowed range providers can choose for their service area</p>
                </div>
            </div>

            <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-900/40 p-4">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-bold">How it works</p>
                    <p>These limits control the slider range that providers see in their profile. Changes take effect immediately — no redeployment needed. Booking dispatch automatically uses the maximum radius as the candidate search net.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Minimum</p>
                    <p className="text-3xl font-black text-emerald-600">{limits.minimumRadius} <span className="text-base">km</span></p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Maximum</p>
                    <p className="text-3xl font-black text-emerald-600">{limits.maximumRadius} <span className="text-base">km</span></p>
                </div>
            </div>

            <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
                <h2 className="text-sm font-black text-foreground uppercase tracking-widest border-b border-border pb-3">Update Limits</h2>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="min-radius" className="text-xs font-black text-muted-foreground uppercase tracking-wider">Minimum Radius (km)</label>
                        <input id="min-radius" type="number" min={1} step={1} value={draft.minimumRadius}
                            onChange={(e) => setDraft(d => ({ ...d, minimumRadius: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-background p-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <p className="text-[10px] text-muted-foreground">Must be greater than 0. Providers cannot select a radius below this value.</p>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="max-radius" className="text-xs font-black text-muted-foreground uppercase tracking-wider">Maximum Radius (km)</label>
                        <input id="max-radius" type="number" min={1} step={1} value={draft.maximumRadius}
                            onChange={(e) => setDraft(d => ({ ...d, maximumRadius: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-background p-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <p className="text-[10px] text-muted-foreground">Must be greater than the minimum. Also determines the broadest geo-search net for booking dispatch.</p>
                    </div>
                </div>
                <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preview — Provider Slider Range</p>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground">{draft.minimumRadius} km</span>
                        <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-200" />
                        <span className="text-xs font-bold text-muted-foreground">{draft.maximumRadius} km</span>
                    </div>
                </div>
                <button id="save-radius-limits-btn" type="submit" disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60">
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save Radius Limits'}
                </button>
            </form>
        </div>
    );
};

export default AdminServiceRadius;
