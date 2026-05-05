import React, { useState, useEffect } from 'react';
import { useOutletContext } from "react-router-dom";
import { 
    History, Search, Filter, Calendar, User, 
    ShieldCheck, UserCheck, Briefcase, FileText, 
    ChevronLeft, ChevronRight, Loader2, ArrowUpRight,
    Ban, CheckCircle2, XCircle, MoreVertical, LayoutGrid, List
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import API from "@/lib/api";

const AdminAuditLogs = () => {
    const { setTitle } = useOutletContext();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'timeline'
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        entityType: '',
        adminId: '',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        setTitle("Verification Audit Logs");
        const delayDebounceFn = setTimeout(() => {
            fetchLogs();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [setTitle, page, filters, search]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: viewMode === 'timeline' ? 10 : 15,
                search,
                ...filters
            });
            const { data } = await API.get(`/admin/audit-logs?${params.toString()}`);
            setLogs(data.logs);
            setTotalPages(data.pages);
        } catch (error) {
            toast.error("Failed to load audit logs");
        } finally {
            setLoading(false);
        }
    };

    const getEntityIcon = (type) => {
        switch (type) {
            case 'USER': return <User className="h-4 w-4" />;
            case 'SEWAK': return <Briefcase className="h-4 w-4" />;
            case 'VENDOR': return <UserCheck className="h-4 w-4" />;
            case 'KYC': return <ShieldCheck className="h-4 w-4" />;
            default: return <History className="h-4 w-4" />;
        }
    };

    const getActionBadge = (action) => {
        const styles = {
            'VERIFY': 'bg-emerald-50 text-emerald-700 border-emerald-100',
            'REJECT': 'bg-red-50 text-red-700 border-red-100',
            'BLOCK': 'bg-slate-900 text-white border-slate-900',
            'UNBLOCK': 'bg-blue-50 text-blue-700 border-blue-100',
            'UPDATE_STATUS': 'bg-amber-50 text-amber-700 border-amber-100'
        };
        const style = styles[action] || 'bg-gray-50 text-gray-700 border-gray-100';
        return (
            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${style}`}>
                {action.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-5 md:p-8 text-white shadow-2xl">
                <div className="relative z-10 space-y-3 max-w-3xl">
                    <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                        <History className="h-3 w-3 text-blue-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400">Security Audit</span>
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-none">
                            Verification Activity
                        </h1>
                        <p className="text-slate-400 font-bold text-xs md:text-sm opacity-80 leading-relaxed max-w-xl">
                            Real-time audit trail of administrative actions and platform transparency.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
                            <button 
                                onClick={() => setViewMode('table')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <List className="h-3 w-3" /> Table
                            </button>
                            <button 
                                onClick={() => setViewMode('timeline')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <History className="h-3 w-3" /> Timeline
                            </button>
                        </div>
                    </div>
                </div>

                {/* Abstract Design Elements */}
                <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 pointer-events-none hidden md:block">
                    <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full border-[16px] border-white/20" />
                    <div className="absolute bottom-1/4 left-1/4 w-32 h-32 rounded-full border-[8px] border-white/20" />
                </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/20">
                <div className="lg:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Search Records</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                            placeholder="Entity or Admin Name..." 
                            className="pl-11 rounded-2xl border-gray-100 bg-gray-50/50 h-12 text-sm font-bold"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Entity Type</label>
                    <select 
                        value={filters.entityType}
                        onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value }))}
                        className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-4 h-12 text-sm font-bold focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                    >
                        <option value="">All Entities</option>
                        <option value="USER">Customers</option>
                        <option value="SEWAK">Sewaks</option>
                        <option value="VENDOR">Vendors</option>
                        <option value="KYC">KYC Requests</option>
                    </select>
                </div>

                <div className="lg:col-span-5 space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Date Range</label>
                    <div className="flex items-center gap-3">
                        <Input 
                            type="date" 
                            className="rounded-2xl border-gray-100 bg-gray-50/50 text-xs font-bold h-12"
                            value={filters.startDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                        <span className="text-gray-300 font-black px-1">→</span>
                        <Input 
                            type="date" 
                            className="rounded-2xl border-gray-100 bg-gray-50/50 text-xs font-bold h-12"
                            value={filters.endDate}
                            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="lg:col-span-2 flex items-end">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            setFilters({ entityType: '', adminId: '', startDate: '', endDate: '' });
                            setSearch('');
                        }}
                        className="w-full rounded-2xl border-gray-200 font-black uppercase text-[10px] h-12 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                    >
                        Clear All
                    </Button>
                </div>
            </div>

            {/* View Switching Logic */}
            <AnimatePresence mode="wait">
                {viewMode === 'table' ? (
                    <motion.div 
                        key="table"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="rounded-[2.5rem] border-0 shadow-2xl shadow-gray-200/50 overflow-hidden bg-white">
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Action & Entity</th>
                                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Performed By</th>
                                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Outcome</th>
                                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Timestamp</th>
                                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Reference</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan="5" className="py-24 text-center">
                                                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4 opacity-50" />
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Retrieving Secure Records...</p>
                                                    </td>
                                                </tr>
                                            ) : logs.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="py-24 text-center text-gray-400">
                                                        <History className="h-16 w-16 mx-auto mb-4 opacity-5" />
                                                        <p className="font-black text-slate-900 text-lg">No activity matching your filters.</p>
                                                        <p className="text-sm font-bold text-gray-400">Try adjusting your search or date range.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                logs.map((log) => (
                                                    <tr key={log._id} className="hover:bg-blue-50/30 transition-colors group">
                                                        <td className="px-8 py-7">
                                                            <div className="flex items-center gap-5">
                                                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border-2 border-white shadow-lg transition-all group-hover:scale-110 group-hover:rotate-3 ${
                                                                    log.entityType === 'USER' ? 'bg-emerald-50 text-emerald-600' :
                                                                    log.entityType === 'SEWAK' ? 'bg-blue-50 text-blue-600' :
                                                                    log.entityType === 'VENDOR' ? 'bg-amber-50 text-amber-600' :
                                                                    'bg-slate-900 text-white'
                                                                }`}>
                                                                    {getEntityIcon(log.entityType)}
                                                                </div>
                                                                <div>
                                                                    <p className="font-black text-gray-900 tracking-tight text-base">{log.entityName || 'Unnamed Entity'}</p>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em]">
                                                                        {log.entityType} <span className="mx-1 text-gray-200">|</span> 
                                                                        <span className="font-mono">ID: {log.entityId?.slice(-8).toUpperCase()}</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-7">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 rounded-full bg-slate-900/5 flex items-center justify-center text-[10px] font-black text-slate-700 border border-slate-200 shadow-sm">
                                                                    {log.verifiedByName?.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-black text-gray-800">{log.verifiedByName}</p>
                                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-70">{log.verifiedByRole}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-7 text-center">
                                                            {getActionBadge(log.actionType)}
                                                        </td>
                                                        <td className="px-8 py-7">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-black text-gray-900">
                                                                    {new Date(log.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </p>
                                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-7 text-right">
                                                            <button className="h-10 w-10 rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95 group/btn">
                                                                <ArrowUpRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="timeline"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-8"
                    >
                        {loading ? (
                            <div className="py-24 text-center">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="py-24 text-center bg-white rounded-[2.5rem] border border-gray-100 shadow-xl">
                                <History className="h-16 w-16 mx-auto mb-4 opacity-5" />
                                <p className="font-black text-slate-900 text-lg">Timeline is empty.</p>
                            </div>
                        ) : (
                            <div className="relative space-y-12 before:absolute before:left-[23px] before:top-2 before:h-[calc(100%-16px)] before:w-1 before:bg-gradient-to-b before:from-blue-600 before:to-slate-200 before:rounded-full">
                                {logs.map((log, idx) => (
                                    <motion.div 
                                        key={log._id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="relative pl-20"
                                    >
                                        <div className="absolute left-0 top-0 h-12 w-12 rounded-full bg-white border-4 border-blue-600 flex items-center justify-center z-10 shadow-lg shadow-blue-200">
                                            {getEntityIcon(log.entityType)}
                                        </div>
                                        
                                        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 relative group hover:shadow-2xl hover:shadow-blue-200/20 transition-all">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        {getActionBadge(log.actionType)}
                                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">•</span>
                                                        <span className="text-xs font-black text-gray-900">
                                                            {new Date(log.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })} at {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                                        {log.entityName} <span className="text-slate-300 font-normal">was</span> {log.actionType === 'VERIFY' ? 'Verified' : log.actionType.toLowerCase().replace('_', ' ')}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                                        <span className="flex h-6 w-6 rounded-full bg-slate-100 items-center justify-center text-[8px] font-black">{log.verifiedByName?.charAt(0)}</span>
                                                        Action taken by <span className="text-blue-600">{log.verifiedByName}</span>
                                                        <span className="text-slate-300">({log.verifiedByRole})</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-right min-w-[200px]">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Entity Reference</p>
                                                        <p className="text-xs font-mono font-black text-slate-900">ID_{log.entityId}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-xl">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Data Navigation</p>
                    <p className="text-sm font-black text-gray-900">
                        Page <span className="text-blue-600">{page}</span> of <span className="text-blue-600">{totalPages || 1}</span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="rounded-2xl h-14 px-8 border-gray-200 font-black uppercase text-xs hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                        <ChevronLeft className="h-5 w-5 mr-2" /> Previous
                    </Button>
                    <Button
                        variant="outline"
                        disabled={page === totalPages || totalPages === 0}
                        onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="rounded-2xl h-14 px-8 border-gray-200 font-black uppercase text-xs hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                    >
                        Next <ChevronRight className="h-5 w-5 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AdminAuditLogs;
