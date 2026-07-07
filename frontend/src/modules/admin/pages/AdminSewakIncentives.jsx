import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useScrollLock } from '@/lib/scrollLock';
import { 
    Zap, Search, Filter, Calendar, User, 
    CheckCircle2, IndianRupee, TrendingUp, 
    Clock, ChevronLeft, ChevronRight, Loader2,
    Settings, Save, Info, ArrowUpRight,
    X, FileText, CreditCard, Camera, MoreVertical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import API from "@/lib/api";

const AdminSewakIncentives = () => {
    const { setTitle } = useOutletContext();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({ threshold: 5, bonusAmount: 50 });
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useScrollLock(!!selectedProvider);

    const fetchIncentiveData = async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/sewak-incentives', {
                params: { date: dateFilter }
            });
            setLogs(response.data.logs);
            setConfig(response.data.config);
        } catch (error) {
            toast.error("Failed to load incentive data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setTitle("Sewak Incentives");
    }, [setTitle]);

    useEffect(() => {
        fetchIncentiveData();
    }, [dateFilter]);

    const handleUpdateConfig = async () => {
        setIsUpdatingConfig(true);
        try {
            await API.post('/admin/sewak-incentive-settings', config);
            toast.success("Incentive settings updated");
            fetchIncentiveData();
        } catch (error) {
            toast.error("Failed to update settings");
        } finally {
            setIsUpdatingConfig(false);
        }
    };

    const filteredLogs = logs.filter(log => 
        log.sewakId?.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
        log.sewakId?.shopName?.toLowerCase().includes(search.toLowerCase())
    );

    const totalBonusToday = logs.reduce((sum, log) => sum + log.bonusEarned, 0);

    return (
        <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header & Configuration */}
            <div className="flex flex-col lg:flex-row justify-between gap-8">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Productivity Hub</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Sewak Daily Incentives</h1>
                    <p className="text-gray-500 font-bold max-w-md">Reward your high-performing Sewaks based on their daily booking completions.</p>
                </div>

                <Card className="border-blue-100 shadow-xl shadow-blue-50 bg-white min-w-[400px]">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <Settings className="h-4 w-4 text-blue-600" />
                            INCENTIVE CONFIGURATION
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Daily Threshold</label>
                                <Input 
                                    type="number"
                                    min="0"
                                    value={config.threshold}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || Number(val) >= 0) {
                                            setConfig({...config, threshold: val});
                                        }
                                    }}
                                    className="h-11 rounded-xl font-black text-sm border-gray-100"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Bonus per Extra (₹)</label>
                                <Input 
                                    type="number"
                                    min="0"
                                    value={config.bonusAmount}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || Number(val) >= 0) {
                                            setConfig({...config, bonusAmount: val});
                                        }
                                    }}
                                    className="h-11 rounded-xl font-black text-sm border-gray-100"
                                />
                            </div>
                        </div>
                        <Button 
                            onClick={handleUpdateConfig}
                            disabled={isUpdatingConfig}
                            className="w-full h-11 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-xl transition-all"
                        >
                            {isUpdatingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Logic Updates"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-0 shadow-lg bg-emerald-500 text-white overflow-hidden relative group">
                    <CardContent className="p-6">
                        <TrendingUp className="h-12 w-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Bonus Distributed</p>
                        <h2 className="text-4xl font-black mt-2 flex items-center gap-2">
                            <IndianRupee className="h-8 w-8" />
                            {totalBonusToday}
                        </h2>
                        <p className="text-[10px] font-bold mt-2 opacity-60">Calculated for {dateFilter}</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-blue-600 text-white overflow-hidden relative group">
                    <CardContent className="p-6">
                        <CheckCircle2 className="h-12 w-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Eligible Bookings</p>
                        <h2 className="text-4xl font-black mt-2">{logs.filter(l => l.dailyBookingCount > config.threshold).length}</h2>
                        <p className="text-[10px] font-bold mt-2 opacity-60">Over threshold completions</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-lg bg-slate-900 text-white overflow-hidden relative group">
                    <CardContent className="p-6">
                        <User className="h-12 w-12 absolute -right-2 -bottom-2 opacity-20 group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Active High-Performers</p>
                        <h2 className="text-4xl font-black mt-2">{new Set(logs.filter(l => l.dailyBookingCount > config.threshold).map(l => l.sewakId?._id)).size}</h2>
                        <p className="text-[10px] font-bold mt-2 opacity-60">Unique Sewaks earning today</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Search by Sewak name..." 
                                className="pl-11 h-12 rounded-2xl border-gray-100 font-bold"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                type="date"
                                className="pl-11 h-12 rounded-2xl border-gray-100 font-bold min-w-[180px]"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <Card className="border-gray-100 shadow-xl shadow-gray-100/50 rounded-[2rem] overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Sewak Profile</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Daily Count</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Incentive Status</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400">Bonus Earned</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="5" className="py-24 text-center">
                                                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-24 text-center">
                                                <Info className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                                                <p className="font-black text-gray-400 uppercase tracking-widest">No incentive records found for this date.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <tr key={log._id} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg border-2 border-white shadow-sm">
                                                            {log.sewakId?.ownerName?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-gray-900">{log.sewakId?.ownerName}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase">{log.sewakId?.shopName}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-900 text-white font-black text-sm">
                                                        {log.dailyBookingCount}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    {log.dailyBookingCount > config.threshold ? (
                                                        <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                                            ELIGIBLE (+{log.dailyBookingCount - config.threshold})
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1.5 rounded-full bg-gray-50 text-gray-500 text-[9px] font-black uppercase tracking-widest border border-gray-100">
                                                            PENDING ({config.threshold - log.dailyBookingCount} more)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-1 font-black text-emerald-600">
                                                        <IndianRupee className="h-3.5 w-3.5" />
                                                        {log.bonusEarned}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="rounded-xl h-10 w-10 p-0 hover:bg-slate-900 hover:text-white transition-all"
                                                        onClick={() => setSelectedProvider(log.sewakId)}
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Provider Details Modal */}
            <AnimatePresence>
                {selectedProvider && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
                        onClick={() => setSelectedProvider(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl custom-scrollbar"
                        >
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-4 backdrop-blur-md">
                                <h3 className="text-lg font-bold text-gray-900">Sewak Details</h3>
                                <button
                                    onClick={() => setSelectedProvider(null)}
                                    className="rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-8">
                                {/* Profile & Business Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-600">
                                            <FileText className="h-4 w-4" /> Profile Info
                                        </h4>
                                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
                                            <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500">Owner Name</span><span className="font-semibold text-gray-900">{selectedProvider.ownerName || 'N/A'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500">Business Name</span><span className="font-semibold text-gray-900">{selectedProvider.shopName || 'N/A'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500">Mobile</span><span className="font-semibold text-gray-900">{selectedProvider.mobile || 'N/A'}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-semibold text-gray-900">{selectedProvider.email || 'N/A'}</span></div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-600">
                                            <CheckCircle2 className="h-4 w-4" /> Business & KYC
                                        </h4>
                                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
                                            <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500">Category / Role</span><span className="font-semibold text-gray-900 capitalize">{selectedProvider.providerCategory || 'Sewak'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500">Aadhaar No</span><span className="font-semibold text-gray-900 tracking-wider">{selectedProvider.kycAadhaar || 'N/A'}</span></div>
                                            <div className="flex justify-between border-b border-gray-200 pb-2"><span className="text-gray-500">PAN No</span><span className="font-semibold text-gray-900 tracking-wider">{selectedProvider.kycPanNumber || 'N/A'}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">GST Number</span><span className="font-semibold text-gray-900 tracking-wider">{selectedProvider.gst || 'N/A'}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Details */}
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-purple-600">
                                        <CreditCard className="h-4 w-4" /> Bank Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-purple-50/50 p-4 text-sm">
                                        <div className="flex justify-between"><span className="text-gray-500">Account Holder</span><span className="font-semibold text-gray-900">{selectedProvider.bankDetails?.accountHolderName || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Account Number</span><span className="font-semibold text-gray-900">{selectedProvider.bankDetails?.accountNumber || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">IFSC Code</span><span className="font-semibold text-gray-900">{selectedProvider.bankDetails?.ifscCode || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Bank Name</span><span className="font-semibold text-gray-900">{selectedProvider.bankDetails?.bankName || 'N/A'}</span></div>
                                    </div>
                                </div>

                                {/* Documents / Images */}
                                <div className="space-y-4">
                                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-orange-600">
                                        <Camera className="h-4 w-4" /> Documents
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: "Profile Photo", url: selectedProvider.profileImage },
                                            { label: "Aadhaar Front", url: selectedProvider.kycAadhaarPhoto },
                                            { label: "Aadhaar Back", url: selectedProvider.kycAadhaarBackPhoto },
                                            { label: "PAN Card", url: selectedProvider.kycPanPhoto }
                                        ].map((doc, idx) => (
                                            <div key={idx} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-2 bg-white">
                                                <span className="text-xs font-semibold text-gray-500 text-center uppercase">{doc.label}</span>
                                                {doc.url ? (
                                                    <a href={doc.url} target="_blank" rel="noreferrer" className="block h-32 rounded-lg overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity">
                                                        <img src={doc.url} alt={doc.label} className="h-full w-full object-cover" />
                                                    </a>
                                                ) : (
                                                    <div className="flex h-32 items-center justify-center rounded-lg bg-gray-50 border border-dashed border-gray-200">
                                                        <span className="text-xs text-gray-400">Not Uploaded</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminSewakIncentives;
