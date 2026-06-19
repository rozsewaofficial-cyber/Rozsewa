import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, ChevronRight, Shield, XCircle, PackageCheck, Bike, Wrench, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '@/lib/api';

const steps = [
    { label: "Placed", fullLabel: "Booking Placed", status: "pending", icon: PackageCheck, color: "blue" },
    { label: "Accepted", fullLabel: "Provider Accepted", status: "confirmed", icon: Check, color: "indigo" },
    { label: "On the Way", fullLabel: "On the Way", status: "on_the_way", icon: Bike, color: "violet" },
    { label: "In Progress", fullLabel: "Service Started", status: "started", icon: Wrench, color: "amber" },
    { label: "Done", fullLabel: "Completed", status: "completed", icon: Star, color: "emerald" },
];

const statusColorMap = {
    blue: { dot: "bg-blue-500", ring: "ring-blue-400/40", glow: "shadow-blue-500/30", icon: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", pill: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", line: "bg-blue-400" },
    indigo: { dot: "bg-indigo-500", ring: "ring-indigo-400/40", glow: "shadow-indigo-500/30", icon: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-200 dark:border-indigo-800", pill: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400", line: "bg-indigo-400" },
    violet: { dot: "bg-violet-500", ring: "ring-violet-400/40", glow: "shadow-violet-500/30", icon: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-200 dark:border-violet-800", pill: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400", line: "bg-violet-400" },
    amber: { dot: "bg-amber-500", ring: "ring-amber-400/40", glow: "shadow-amber-500/30", icon: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", pill: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", line: "bg-amber-400" },
    emerald: { dot: "bg-emerald-500", ring: "ring-emerald-400/40", glow: "shadow-emerald-500/30", icon: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", pill: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", line: "bg-emerald-400" },
};

const statusIndexMap = { pending: 0, confirmed: 1, on_the_way: 2, started: 3, completed: 4 };

const RecentBookingTracker = () => {
    const navigate = useNavigate();
    const [activeBooking, setActiveBooking] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchActiveBookings = async () => {
        const authData = JSON.parse(localStorage.getItem('rozsewa_auth') || 'null');
        if (!authData?.token) { setLoading(false); return; }
        try {
            const res = await API.get('/bookings');
            const active = res.data.find(b =>
                ['pending', 'confirmed', 'on_the_way', 'started', 'cancelled'].includes(b.status) && (b.rating === undefined || b.rating === 0)
            );
            setActiveBooking(active || null);
        } catch (err) {
            console.error("Failed to fetch active bookings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveBookings();
        const interval = setInterval(fetchActiveBookings, 15000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !activeBooking) return null;

    // Cancelled State
    if (activeBooking.status === 'cancelled') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/my-bookings')}
                className="w-full bg-white dark:bg-slate-900 rounded-[24px] p-5 border border-rose-200 dark:border-rose-900/50 shadow-md shadow-rose-500/5 cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center border border-rose-200 dark:border-rose-800 shrink-0">
                        <XCircle className="h-5 w-5 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-widest text-rose-500">Booking Cancelled</p>
                        <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 truncate">
                            {activeBooking.providerId?.shopName || 'Your booking'}
                        </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
            </motion.div>
        );
    }

    const currentStep = statusIndexMap[activeBooking.status] || 0;
    const currentStepData = steps[currentStep];
    const colors = statusColorMap[currentStepData.color];
    const providerName = activeBooking.providerId?.shopName || 'Finding Expert...';
    const bookingId = activeBooking._id?.substring(activeBooking._id.length - 6).toUpperCase();

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                onClick={() => navigate('/tracking')}
                className="w-full bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-md cursor-pointer group"
            >
                {/* Top colored bar */}
                <div className={`h-1 w-full ${colors.line}`} />

                <div className="p-4 pb-5">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className={`h-9 w-9 ${colors.bg} ${colors.border} border rounded-full flex items-center justify-center shrink-0`}>
                                <Clock className={`h-4 w-4 ${colors.icon}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Booking · #{bookingId}</p>
                                <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight">{providerName}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.pill} border ${colors.border}`}>
                            <motion.span
                                className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
                                animate={{ opacity: [1, 0.4, 1] }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                            />
                            <span className="text-[10px] font-black uppercase tracking-wider">{currentStepData.fullLabel}</span>
                        </div>
                    </div>

                    {/* Horizontal Timeline */}
                    <div className="relative flex items-center">
                        {steps.map((step, i) => {
                            const isDone = i < currentStep;
                            const isActive = i === currentStep;
                            const Icon = step.icon;
                            const c = statusColorMap[step.color];

                            return (
                                <React.Fragment key={i}>
                                    {/* Step Node */}
                                    <div className="flex flex-col items-center gap-1 z-10 relative">
                                        <div className={`
                                            h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                            ${isDone ? `${c.bg} ${c.border} border` : isActive ? `${c.bg} ring-4 ${c.ring} border-2 ${c.border}` : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                                        `}>
                                            {isDone ? (
                                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                            ) : (
                                                <Icon className={`h-3.5 w-3.5 ${isActive ? c.icon : 'text-slate-400 dark:text-slate-600'}`} strokeWidth={isActive ? 2.5 : 2} />
                                            )}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-wide text-center leading-tight whitespace-nowrap ${isActive ? `${colors.icon}` : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}>
                                            {step.label}
                                        </span>
                                    </div>

                                    {/* Connector Line */}
                                    {i < steps.length - 1 && (
                                        <div className="flex-1 h-0.5 mx-1 relative overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                            <motion.div
                                                className={`absolute top-0 left-0 h-full ${i < currentStep ? 'bg-emerald-400' : 'bg-transparent'}`}
                                                initial={{ width: "0%" }}
                                                animate={{ width: i < currentStep ? "100%" : "0%" }}
                                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                            />
                                            {i === currentStep - 1 && (
                                                <motion.div
                                                    className="absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-emerald-300 to-transparent"
                                                    animate={{ x: ["-100%", "800%"] }}
                                                    transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                                                />
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Tap to track in real-time</p>
                        <div className="flex items-center gap-1 text-[11px] font-black text-blue-600 dark:text-blue-400">
                            View Tracking <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default RecentBookingTracker;
