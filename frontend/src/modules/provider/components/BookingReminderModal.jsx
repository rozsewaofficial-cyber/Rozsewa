import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Clock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BookingReminderModal = ({ data, onDismiss }) => {
    const audioRef = useRef(null);
    const navigate = useNavigate();
    const [audioStarted, setAudioStarted] = useState(true);
    const [timer, setTimer] = useState(30);

    const playAudio = () => {
        if (!audioRef.current) return;
        audioRef.current.play()
            .then(() => setAudioStarted(true))
            .catch(e => {
                console.log('Audio autoplay blocked', e);
                setAudioStarted(false);
            });
    };

    useEffect(() => {
        audioRef.current = new Audio('/sounds/alert.mp3');
        audioRef.current.loop = true;
        playAudio();

        const countdown = setInterval(() => {
            setTimer(prev => {
                if (prev <= 1) {
                    handleAcknowledge();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            clearInterval(countdown);
        };
    }, []);

    const handleAcknowledge = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        onDismiss();
        navigate('/provider');
    };

    const booking = data.booking || {};

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-background shadow-2xl border-2 border-amber-500/20"
                >
                    <div className="relative p-6 pt-10">
                        {/* Background glowing orb */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl" />

                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="h-20 w-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center relative">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="absolute inset-0 bg-amber-500/20 rounded-full"
                                />
                                <AlertCircle className="h-10 w-10 text-amber-600 animate-pulse" />
                            </div>

                            <div className="space-y-1">
                                <h2 className="text-2xl font-black tracking-tight uppercase text-amber-600">Upcoming Booking!</h2>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                                    In 20 Minutes
                                </p>
                            </div>

                            {!audioStarted && (
                                <button
                                    onClick={playAudio}
                                    className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full text-xs font-bold flex items-center gap-2 animate-bounce"
                                >
                                    <Bell className="h-4 w-4" />
                                    Tap to Enable Sound
                                </button>
                            )}

                            <div className="w-full bg-muted/50 rounded-3xl p-5 space-y-4 text-left border border-border">
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Service</p>
                                    <p className="font-black text-lg text-foreground truncate">{booking.serviceName || "Service"}</p>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border">
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Time</p>
                                        <div className="flex items-center text-sm font-black text-amber-600">
                                            <Clock className="h-4 w-4 mr-1" />
                                            {booking.bookingTime || "N/A"}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Location</p>
                                        <p className="font-bold text-xs text-foreground truncate max-w-[120px]">
                                            {booking.address || "N/A"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full space-y-2">
                                <button
                                    onClick={handleAcknowledge}
                                    className="h-16 w-full rounded-2xl bg-amber-600 text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 transition-all font-black uppercase text-xs tracking-widest"
                                >
                                    <Check className="h-5 w-5" /> Acknowledge
                                </button>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">
                                    Auto-closing in {timer}s
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BookingReminderModal;
