import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MapPin, IndianRupee, Clock, Check, X, ShieldAlert, Volume2 } from 'lucide-react';
import API from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { useScrollLock } from '@/lib/scrollLock';


const IncomingRequestModal = ({ request, onAction }) => {
    useScrollLock(true);
    const { toast } = useToast();

    const { socket, playAlarmSound, stopAlarmSound, alarmSoundPlaying } = useSocket();
    const { user } = useAuth();
    const [timeLeft, setTimeLeft] = useState(120); // 2 mins countdown

    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleMessage, setScheduleMessage] = useState('');
    const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

    // Counter Offer state
    const [isCountering, setIsCountering] = useState(false);
    const [counterAmount, setCounterAmount] = useState('');
    const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);

    const notificationRef = useRef(null);

    const playSound = (e) => {
        playAlarmSound();
    };

    useEffect(() => {
        playAlarmSound();

        const ensurePlay = setInterval(() => {
            if (timeLeft > 0 && !alarmSoundPlaying) {
                playAlarmSound();
            }
        }, 2000);

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                notificationRef.current = new Notification("RozSewa - New Booking Request!", {
                    body: `New request for ${request.serviceName}\nDistance: ${request.address}\nTap to view details.`,
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

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(timer);
            clearInterval(ensurePlay);
            if (notificationRef.current && typeof notificationRef.current.close === 'function') {
                notificationRef.current.close();
            }
        };
    }, [request, alarmSoundPlaying]);

    const handleAccept = async (decision = null) => {
        try {
            const payload = { status: 'confirmed' };
            if (decision && typeof decision === 'string') {
                payload.offerDecision = decision;
            }
            await API.patch(`/bookings/${request.bookingId}/status`, payload);
            toast({ title: "Booking Accepted!", variant: "default" });
            stopAlarmSound();
            onAction('accepted');
        } catch (err) {
            toast({
                title: err.response?.status === 409 ? "Booking Taken" : "Failed to accept booking",
                description: err.response?.data?.message || "Something went wrong.",
                variant: err.response?.status === 409 ? "default" : "destructive"
            });
            if (err.response?.status === 409 || err.response?.status === 401) {
                stopAlarmSound();
                sessionStorage.removeItem('activeRequest');
                onAction('taken');
            }
        }
    };

    const handleCounterSubmit = async () => {
        const amt = Number(counterAmount);
        if (!amt || isNaN(amt) || amt <= 0) {
            toast({ title: "Validation Error", description: "Please enter a valid positive amount.", variant: "destructive" });
            return;
        }
        if (amt <= request.amount) {
            toast({ title: "Validation Error", description: `Counter offer must be greater than customer's offer of ₹${request.amount}.`, variant: "destructive" });
            return;
        }
        if (amt > request.originalFixedPrice) {
            toast({ title: "Validation Error", description: `Counter offer cannot exceed original fixed price of ₹${request.originalFixedPrice}.`, variant: "destructive" });
            return;
        }

        setIsSubmittingCounter(true);
        try {
            await API.patch(`/bookings/${request.bookingId}/status`, {
                status: 'pending',
                offerDecision: 'counter',
                counterAmount: amt
            });
            toast({ title: "Counter Offer Sent!", description: `Proposed ₹${amt} to the customer.`, variant: "default" });

            stopAlarmSound();
            sessionStorage.removeItem('activeRequest');
            onAction('countered');
        } catch (err) {
            toast({
                title: err.response?.status === 409 ? "Booking Taken" : "Failed to send counter-offer",
                description: err.response?.data?.message || "Something went wrong.",
                variant: err.response?.status === 409 ? "default" : "destructive"
            });
            if (err.response?.status === 409 || err.response?.status === 401) {
                stopAlarmSound();
                sessionStorage.removeItem('activeRequest');
                onAction('taken');
            }
        } finally {
            setIsSubmittingCounter(false);
        }
    };

    const handleScheduleSubmit = async () => {
        if (!scheduleDate || !scheduleTime) {
            toast({ title: "Validation Error", description: "Date and Time are required.", variant: "destructive" });
            return;
        }

        setIsSubmittingSchedule(true);
        try {
            await API.patch(`/bookings/${request.bookingId}/propose-schedule`, {
                date: scheduleDate,
                time: scheduleTime,
                message: scheduleMessage
            });
            toast({ title: "Schedule Proposed", description: "Waiting for customer approval.", variant: "default" });

            stopAlarmSound();
            sessionStorage.removeItem('activeRequest');
            onAction('scheduled');
        } catch (err) {
            toast({ title: "Failed to propose schedule", description: err.response?.data?.message || err.message, variant: "destructive" });
        } finally {
            setIsSubmittingSchedule(false);
        }
    };

    const handleReject = () => {
        if (socket && user) {
            socket.emit("reject_booking", {
                providerId: user._id,
                bookingId: request.bookingId
            });
        }
        stopAlarmSound();
        sessionStorage.removeItem('activeRequest');
        onAction();
    };

    useEffect(() => {
        if (timeLeft === 0) {
            handleReject();
        }
    }, [timeLeft]);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="w-full max-w-sm bg-card border-2 border-emerald-500/30 rounded-[40px] p-6 shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden relative"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500/20">
                        <motion.div
                            initial={{ width: "100%" }}
                            animate={{ width: "0%" }}
                            transition={{ duration: 120, ease: "linear" }}
                            className="h-full bg-emerald-500"
                        />
                    </div>

                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center relative">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="absolute inset-0 bg-emerald-500/20 rounded-full"
                            />
                            <Bell className="h-10 w-10 text-emerald-600 animate-bounce" />
                        </div>

                        {!alarmSoundPlaying && (
                            <button
                                onClick={playSound}
                                className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase flex items-center gap-2 animate-pulse border border-amber-200"
                            >
                                <Volume2 className="h-3 w-3" /> Tap to Enable Sound
                            </button>
                        )}

                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tight uppercase">New Request!</h2>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                                <Clock className="h-3 w-3" /> Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                            </p>
                        </div>

                        {isScheduling ? (
                            <div className="w-full bg-muted/50 rounded-3xl p-5 space-y-4 text-left border border-border">
                                <h3 className="text-sm font-black text-foreground uppercase tracking-widest text-center">Propose New Time</h3>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Date</label>
                                    <input
                                        type="date"
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Time</label>
                                    <input
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Message for Customer</label>
                                    <textarea
                                        placeholder="e.g. Can we do it at this time? I'm currently busy."
                                        value={scheduleMessage}
                                        onChange={(e) => setScheduleMessage(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-20"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button
                                        onClick={() => setIsScheduling(false)}
                                        className="h-12 rounded-xl border-2 border-border bg-background hover:bg-muted flex items-center justify-center transition-all font-black uppercase text-[10px] tracking-widest text-muted-foreground"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleScheduleSubmit}
                                        disabled={isSubmittingSchedule}
                                        className="h-12 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center transition-all font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                                    >
                                        {isSubmittingSchedule ? 'Sending...' : 'Send Proposal'}
                                    </button>
                                </div>
                            </div>
                        ) : isCountering ? (
                            <div className="w-full bg-muted/50 rounded-3xl p-5 space-y-4 text-left border border-border">
                                <h3 className="text-sm font-black text-foreground uppercase tracking-widest text-center">Propose Counter Offer</h3>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Counter Amount (₹)</label>
                                    <input
                                        type="number"
                                        placeholder={`Between ₹${request.amount + 1} and ₹${request.originalFixedPrice}`}
                                        value={counterAmount}
                                        onChange={(e) => setCounterAmount(e.target.value)}
                                        className="w-full bg-background border border-border rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                    <p className="text-[9px] text-muted-foreground">
                                        Must be greater than customer's offer (₹{request.amount}) and less than or equal to fixed price (₹{request.originalFixedPrice}).
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button
                                        onClick={() => setIsCountering(false)}
                                        className="h-12 rounded-xl border-2 border-border bg-background hover:bg-muted flex items-center justify-center transition-all font-black uppercase text-[10px] tracking-widest text-muted-foreground"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCounterSubmit}
                                        disabled={isSubmittingCounter}
                                        className="h-12 rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-95 flex items-center justify-center transition-all font-black uppercase text-[10px] tracking-widest disabled:opacity-50"
                                    >
                                        {isSubmittingCounter ? 'Sending...' : 'Send Counter'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-full bg-muted/50 rounded-3xl p-5 space-y-4 text-left border border-border">
                                    <div className="flex items-start gap-3">
                                        <ShieldAlert className="h-5 w-5 text-emerald-600 mt-1" />
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Service Requested</p>
                                            <p className="font-black text-lg text-foreground">{request.serviceName}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-5 w-5 text-emerald-600 mt-1" />
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Customer Location</p>
                                            <p className="font-bold text-sm text-foreground">{request.address}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border">
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total Amount</p>

                                            {request.customerOffer ? (
                                                <>
                                                    <div className="flex items-center text-sm font-black text-emerald-600 italic line-through opacity-70">
                                                        <IndianRupee className="h-3 w-3" /> {request.originalFixedPrice}
                                                    </div>
                                                    <div className="flex items-center text-xl font-black text-emerald-600 mt-0.5">
                                                        <IndianRupee className="h-5 w-5" /> {request.amount}
                                                        <span className="text-[9px] ml-2 text-blue-600 font-black bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-widest">Proposed</span>
                                                    </div>
                                                </>
                                            ) : request.discountAmount > 0 ? (
                                                <>
                                                    <div className="flex items-center text-sm font-black text-emerald-600 italic line-through opacity-70">
                                                        <IndianRupee className="h-3 w-3" /> {request.amount + request.discountAmount}
                                                    </div>
                                                    <div className="flex items-center text-xl font-black text-emerald-600 mt-0.5">
                                                        <IndianRupee className="h-5 w-5" /> {request.amount}
                                                        <span className="text-[9px] ml-2 text-emerald-700 font-black bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full uppercase tracking-widest">Discounted</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center text-xl font-black text-emerald-600">
                                                    <IndianRupee className="h-5 w-5" /> {request.amount}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Payment Mode</p>
                                            <p className={`font-bold text-xs ${request.paymentMode === 'now' ? 'text-blue-600' : 'text-amber-600'}`}>
                                                {request.paymentMode === 'now' ? 'Wait for Online Pay' : 'Pay After Job (COD)'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {request.bargainDiscount > 0 ? (
                                    <div className="flex flex-col gap-2 w-full pt-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={handleReject}
                                                className="h-12 rounded-2xl border-2 border-rose-500/10 bg-background hover:bg-rose-50 flex items-center justify-center gap-1 transition-all font-black uppercase text-[10px] tracking-widest text-rose-600 group"
                                            >
                                                <X className="h-4 w-4" /> Reject
                                            </button>
                                            <button
                                                onClick={() => handleAccept('accept')}
                                                className="h-12 rounded-2xl bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1 transition-all font-black uppercase text-[10px] tracking-widest group"
                                            >
                                                <Check className="h-4 w-4" /> Accept Offer
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-2 w-full">
                                            <button
                                                onClick={() => setIsCountering(true)}
                                                className="w-full h-12 rounded-2xl border-2 border-purple-500/20 bg-purple-50 hover:bg-purple-100 flex items-center justify-center transition-all font-black uppercase text-[10px] tracking-widest text-purple-700 group"
                                            >
                                                Counter Offer
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2 w-full pt-2">
                                        <button
                                            onClick={handleReject}
                                            className="h-14 rounded-2xl border-2 border-border bg-background hover:bg-muted flex flex-col items-center justify-center gap-1 transition-all font-black uppercase text-[10px] tracking-widest text-muted-foreground group"
                                        >
                                            <X className="h-4 w-4 group-hover:scale-110 transition-transform" /> Reject
                                        </button>
                                        <button
                                            onClick={() => setIsScheduling(true)}
                                            className="h-14 rounded-2xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 flex flex-col items-center justify-center gap-1 transition-all font-black uppercase text-[10px] tracking-widest text-amber-700 group"
                                        >
                                            <Clock className="h-4 w-4 group-hover:scale-110 transition-transform" /> Schedule
                                        </button>
                                        <button
                                            onClick={() => handleAccept()}
                                            className="h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center gap-1 transition-all font-black uppercase text-[10px] tracking-widest group"
                                        >
                                            <Check className="h-4 w-4 group-hover:scale-110 transition-transform" /> Accept
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default IncomingRequestModal;
