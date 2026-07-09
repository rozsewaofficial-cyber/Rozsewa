import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MapPin, IndianRupee, Clock, Check, X, ShieldAlert } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { useScrollLock } from '@/lib/scrollLock';
import { useNavigate } from 'react-router-dom';

const IncomingLeadModal = ({ request, onAction }) => {
    useScrollLock(true);
    const { playAlarmSound, stopAlarmSound, alarmSoundPlaying } = useSocket();
    const navigate = useNavigate();
    const notificationRef = useRef(null);

    useEffect(() => {
        playAlarmSound();

        const ensurePlay = setInterval(() => {
            if (!alarmSoundPlaying) {
                playAlarmSound();
            }
        }, 2000);

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                notificationRef.current = new Notification("RozSewa - New Lead Request!", {
                    body: `New lead for ${request.serviceName}\nLocation: ${request.location}\nTap to view details.`,
                    requireInteraction: true,
                    vibrate: [200, 100, 200, 100, 200, 100, 200]
                });

                notificationRef.current.onclick = () => {
                    window.focus();
                };
            } catch (err) {
                console.log("Notification API error:", err);
            }
        }

        return () => {
            clearInterval(ensurePlay);
            if (notificationRef.current && typeof notificationRef.current.close === 'function') {
                notificationRef.current.close();
            }
        };
    }, [request, alarmSoundPlaying]);

    const handleViewLead = () => {
        stopAlarmSound();
        sessionStorage.removeItem('activeLeadRequest');
        navigate('/provider/leads');
        onAction();
    };

    const handleDismiss = () => {
        stopAlarmSound();
        sessionStorage.removeItem('activeLeadRequest');
        onAction();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl relative"
                >
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 opacity-20 animate-pulse" />
                    
                    <div className="p-6 relative z-10">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-25" />
                                <div className="h-20 w-20 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center shadow-lg relative z-10">
                                    <Bell className="h-10 w-10 text-white animate-bounce" />
                                </div>
                            </div>
                        </div>

                        <div className="text-center space-y-2 mb-8">
                            <h2 className="text-2xl font-black text-slate-900">New Lead Request!</h2>
                            <p className="text-slate-500 font-medium">{request.serviceName}</p>
                        </div>

                        <div className="space-y-4 bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                                    <p className="text-sm font-semibold text-slate-700">{request.location}</p>
                                </div>
                            </div>
                            
                            <div className="h-px bg-slate-200" />
                            
                            <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-fuchsia-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Schedule</p>
                                    <p className="text-sm font-semibold text-slate-700">{request.schedule}</p>
                                </div>
                            </div>
                            
                            <div className="h-px bg-slate-200" />
                            
                            <div className="flex items-center gap-3">
                                <IndianRupee className="h-5 w-5 text-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lead Value</p>
                                    <p className="text-lg font-black text-slate-900">₹{request.leadPrice}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleDismiss}
                                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all flex justify-center items-center gap-2"
                            >
                                <X className="h-5 w-5" /> Dismiss
                            </button>
                            <button
                                onClick={handleViewLead}
                                className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-black rounded-2xl shadow-lg shadow-violet-500/25 transition-all flex justify-center items-center gap-2 active:scale-95"
                            >
                                <Check className="h-5 w-5" /> View Lead
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default IncomingLeadModal;
