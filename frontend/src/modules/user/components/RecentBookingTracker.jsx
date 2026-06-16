import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, ChevronRight, MapPin, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '@/lib/api';

const RecentBookingTracker = () => {
    const navigate = useNavigate();
    const [activeBooking, setActiveBooking] = useState(null);
    const [loading, setLoading] = useState(true);

    const steps = [
        { label: "Booking Placed", status: "pending" },
        { label: "Provider Accepted", status: "confirmed" },
        { label: "On the Way", status: "on_the_way" },
        { label: "Service Started", status: "started" },
        { label: "Completed", status: "completed" },
    ];

    const fetchActiveBookings = async () => {
        const authData = JSON.parse(localStorage.getItem('rozsewa_auth') || 'null');
        if (!authData?.token) {
            setLoading(false);
            return;
        }

        try {
            const res = await API.get('/bookings');
            const active = res.data.find(b =>
                ['pending', 'confirmed', 'on_the_way', 'started', 'cancelled'].includes(b.status) && (b.rating === undefined || b.rating === 0)
            );
            setActiveBooking(active);
        } catch (err) {
            console.error("Failed to fetch active bookings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveBookings();
        const interval = setInterval(fetchActiveBookings, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading || !activeBooking) return null;

    const getCurrentStepIndex = () => {
        const statusMap = {
            'pending': 0,
            'confirmed': 1,
            'on_the_way': 2,
            'started': 3,
            'completed': 4
        };
        return statusMap[activeBooking.status] || 0;
    };

    const currentStep = getCurrentStepIndex();

    // Custom UI for cancelled bookings
    if (activeBooking.status === 'cancelled') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate('/my-bookings')}
                className="w-full bg-card rounded-3xl p-5 shadow-xl shadow-rose-500/5 border border-rose-100 dark:border-rose-900/30 cursor-pointer group relative overflow-hidden"
            >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 h-40 w-40 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:bg-rose-500/10 transition-all duration-1000" />

                <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-100 dark:border-rose-500/20">
                        <span className="text-rose-600 font-bold text-lg">!</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Request Not Accepted</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Booking #{activeBooking._id.substring(activeBooking._id.length - 8).toUpperCase()}</p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground font-medium pl-13">The provider was unable to accept your request. Please try booking another provider.</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/tracking')}
            className="w-full bg-card rounded-3xl p-5 shadow-xl shadow-emerald-500/5 border border-emerald-100 dark:border-emerald-900/30 cursor-pointer group relative overflow-hidden"
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all duration-1000" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
                        <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Live Tracking</h3>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Booking #{activeBooking._id.substring(activeBooking._id.length - 8).toUpperCase()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{steps[currentStep].label}</span>
                </div>
            </div>

            {/* Compact Progress Line */}
            <div className="flex items-center gap-2 mb-5 px-1">
                {steps.map((_, i) => (
                    <div key={i} className="flex-1 flex items-center gap-1">
                        <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${i <= currentStep ? 'bg-emerald-500 shadow-sm' : 'bg-slate-100 dark:bg-slate-800'}`} />
                        {i === currentStep && (
                            <motion.div
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0"
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/50 mt-2">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-700">
                        <Shield className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Technician</p>
                        <p className="text-sm font-black text-foreground">{activeBooking.providerId?.shopName || 'Searching Expert...'}</p>
                    </div>
                </div>
                <button className="h-10 w-10 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400 rounded-full flex items-center justify-center transition-all border border-slate-100 dark:border-slate-700">
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </motion.div>
    );
};

export default RecentBookingTracker;
