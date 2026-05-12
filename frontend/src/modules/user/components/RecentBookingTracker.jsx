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
        try {
            const res = await API.get('/bookings');
            const active = res.data.find(b =>
                ['pending', 'confirmed', 'on_the_way', 'started'].includes(b.status) && (b.rating === undefined || b.rating === 0)
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/tracking')}
            className="w-full bg-[#1a2b2c] rounded-[2.5rem] p-6 shadow-2xl border border-white/10 cursor-pointer group relative overflow-hidden"
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 h-32 w-32 bg-emerald-500/10 rounded-full blur-[80px] -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-1000" />

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Clock className="h-5 w-5 text-emerald-500 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase italic tracking-wider">Live Tracking</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">#{activeBooking._id.substring(activeBooking._id.length - 8).toUpperCase()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">{steps[currentStep].label}</span>
                </div>
            </div>

            {/* Compact Progress Line */}
            <div className="flex items-center gap-2 mb-4 px-1">
                {steps.map((_, i) => (
                    <div key={i} className="flex-1 flex items-center gap-1">
                        <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${i <= currentStep ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`} />
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

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                        <Shield className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Technician</p>
                        <p className="text-xs font-black text-white italic">{activeBooking.providerId?.shopName || 'Searching Expert...'}</p>
                    </div>
                </div>
                <button className="h-10 w-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                    <ChevronRight className="h-6 w-6" />
                </button>
            </div>
        </motion.div>
    );
};

export default RecentBookingTracker;
