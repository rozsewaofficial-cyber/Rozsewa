import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Phone, MapPin, Navigation, X, AlertTriangle } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';

const AdminSosModal = ({ alertData, onDismiss }) => {
    const { playAlarmSound, stopAlarmSound, alarmSoundPlaying } = useSocket();

    useEffect(() => {
        // Lock body scroll
        document.body.style.overflow = 'hidden';

        // Play alarm sound immediately
        playAlarmSound();

        // Keep verifying alarm sound is playing every 2 seconds
        const soundInterval = setInterval(() => {
            if (!alarmSoundPlaying) {
                playAlarmSound();
            }
        }, 2000);

        return () => {
            document.body.style.overflow = '';
            clearInterval(soundInterval);
            stopAlarmSound();
        };
    }, [alertData, alarmSoundPlaying]);

    if (!alertData) return null;

    const provider = alertData.providerId || {};
    const coords = alertData.location?.coordinates || [0, 0];
    const googleMapsUrl = `https://www.google.com/maps?q=${coords[1]},${coords[0]}`;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-4 border-red-500 rounded-[2.5rem] shadow-[0_0_50px_rgba(239,68,68,0.4)] overflow-hidden p-6 md:p-8 text-center"
            >
                {/* Flashing Red Top Banner */}
                <div className="absolute top-0 inset-x-0 h-2 bg-red-600 animate-pulse" />

                {/* Close button top right */}
                <button
                    onClick={onDismiss}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>

                {/* Alarm Icon Header */}
                <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border-4 border-red-200 dark:border-red-900/40 animate-bounce">
                        <ShieldAlert className="h-10 w-10 animate-pulse" />
                    </div>
                </div>

                {/* Alert Titles */}
                <h2 className="text-2xl md:text-3xl font-black text-red-700 dark:text-red-500 tracking-tight uppercase leading-none">
                    CRITICAL SOS EMERGENCY!
                </h2>
                <p className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-widest mt-2 animate-pulse">
                    Immediate Action Required
                </p>

                {/* Main Details Panel */}
                <div className="my-6 p-5 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/40 rounded-3xl text-left space-y-4">
                    <div>
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Partner Shop / Name</span>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                            {provider.shopName || 'Unknown Partner'}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                            Owner: {provider.ownerName || 'N/A'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-red-100/50 dark:border-red-900/20">
                        <div>
                            <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Contact Number</span>
                            <a
                                href={`tel:${alertData.mobile || provider.mobile || ''}`}
                                className="flex items-center gap-1.5 text-sm font-extrabold text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                            >
                                <Phone className="h-4 w-4 shrink-0" />
                                {alertData.mobile || provider.mobile || 'N/A'}
                            </a>
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Action coordinates</span>
                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-350 block mt-0.5">
                                {coords[1].toFixed(6)}, {coords[0].toFixed(6)}
                            </span>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-red-100/50 dark:border-red-900/20">
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Emergency Address</span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-start gap-1.5 mt-1 leading-relaxed">
                            <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            {alertData.address || provider.address || 'No address specified'}
                        </p>
                    </div>
                </div>

                {/* Footer instructions */}
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-6">
                    Siren alarm will repeat until this alert is acknowledged. Please dial the provider immediately to assist.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <a
                        href={`tel:${alertData.mobile || provider.mobile || ''}`}
                        className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-red-600/20 hover:shadow-red-600/30 hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2"
                    >
                        <Phone className="h-4 w-4" />
                        Call Partner
                    </a>
                    
                    <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-3 px-4 bg-slate-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl text-xs font-black shadow-lg hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2"
                    >
                        <Navigation className="h-4 w-4" />
                        Navigate on Map
                    </a>
                </div>

                <button
                    onClick={onDismiss}
                    className="w-full mt-4 py-3 border border-gray-200 dark:border-slate-800 text-gray-500 hover:text-red-500 dark:text-gray-400 rounded-2xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition active:scale-95"
                >
                    Acknowledge & Stop Siren
                </button>
            </motion.div>
        </div>
    );
};

export default AdminSosModal;
