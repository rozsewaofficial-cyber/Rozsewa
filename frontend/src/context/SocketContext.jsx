import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import API from '@/lib/api';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [incomingRequest, setIncomingRequest] = useState(() => {
        try {
            const saved = sessionStorage.getItem('activeRequest');
            return saved && saved !== "undefined" ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [incomingLeadRequest, setIncomingLeadRequest] = useState(() => {
        try {
            const saved = sessionStorage.getItem('activeLeadRequest');
            return saved && saved !== "undefined" ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });
    const [scheduleAcceptedData, setScheduleAcceptedData] = useState(null);
    const [reminderData, setReminderData] = useState(null);
    const [activeSosAlert, setActiveSosAlert] = useState(null);
    const [activeSosAlerts, setActiveSosAlerts] = useState([]);
    const [unreadSosCount, setUnreadSosCount] = useState(0);
    const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState(0);
    const { user } = useAuth();

    // Alarm Sound Player Management
    const [alarmSoundPlaying, setAlarmSoundPlaying] = useState(false);
    const alarmAudioRef = React.useRef(null);

    const playAlarmSound = () => {
        if (alarmAudioRef.current) {
            alarmAudioRef.current.muted = false;
            alarmAudioRef.current.currentTime = 0;
            alarmAudioRef.current.play()
                .then(() => {
                    setAlarmSoundPlaying(true);
                })
                .catch(err => {
                    console.log("Global Socket Alarm: play failed", err);
                    setAlarmSoundPlaying(false);
                });
        }
    };

    const stopAlarmSound = () => {
        if (alarmAudioRef.current) {
            alarmAudioRef.current.pause();
            alarmAudioRef.current.currentTime = 0;
            setAlarmSoundPlaying(false);
        }
    };

    // Global interaction listener to unlock audio autoplay
    useEffect(() => {
        const audio = new Audio('/sounds/alert.mp3');
        audio.loop = true;
        audio.volume = 1.0;
        alarmAudioRef.current = audio;

        const unlockAudio = () => {
            if (alarmAudioRef.current) {
                alarmAudioRef.current.muted = true;
                alarmAudioRef.current.play()
                    .then(() => {
                        alarmAudioRef.current.pause();
                        alarmAudioRef.current.currentTime = 0;
                        console.log("Global Socket Alarm: Audio unlocked successfully!");
                        window.removeEventListener('click', unlockAudio);
                        window.removeEventListener('touchstart', unlockAudio);
                    })
                    .catch(err => {
                        console.log("Global Socket Alarm: Audio unlock attempt failed:", err);
                    });
            }
        };

        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);

        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            if (alarmAudioRef.current) {
                alarmAudioRef.current.pause();
                alarmAudioRef.current = null;
            }
        };
    }, []);

    // Stop alarm automatically when request is cleared
    useEffect(() => {
        if (!incomingRequest) {
            stopAlarmSound();
        }
    }, [incomingRequest]);

    useEffect(() => {
        if (!user || !user.token) return;

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        // Extract the base URL (protocol + host) and remove /api if present at the end
        const socketUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;

        const newSocket = io(socketUrl, {
            withCredentials: true,
            transports: ['polling', 'websocket']
        });
        setSocket(newSocket);

        newSocket.on("NEW_BOOKING_REQUEST", (data) => {
            console.log("Global Socket: New booking received", data);
            sessionStorage.setItem('activeRequest', JSON.stringify(data));
            setIncomingRequest(data);

            const path = window.location.pathname;
            if (path.startsWith('/provider') || path.startsWith('/sewak')) {
                // playAlarmSound(); // Disabled per user request to let Flutter handle it
            }
        });

        newSocket.on("NEW_LEAD_REQUEST", (data) => {
            console.log("Global Socket: New lead received", data);
            sessionStorage.setItem('activeLeadRequest', JSON.stringify(data));
            setIncomingLeadRequest(data);

            const path = window.location.pathname;
            if (path.startsWith('/provider') || path.startsWith('/sewak')) {
                // playAlarmSound(); // Disabled per user request to let Flutter handle it
            }
        });

        newSocket.on("BOOKING_TAKEN", (data) => {
            setIncomingRequest(prev => {
                if (prev && prev.bookingId === data.bookingId) {
                    sessionStorage.removeItem('activeRequest');
                    stopAlarmSound();
                    return null;
                }
                return prev;
            });
        });

        newSocket.on("BOOKING_REJECTED", (data) => {
            console.log("Global Socket: Booking rejected", data);
            window.dispatchEvent(new CustomEvent('BOOKING_REJECTED', { detail: data }));
        });

        newSocket.on("COUNTER_OFFER_RECEIVED", (data) => {
            console.log("Global Socket: Counter offer received", data);
            window.dispatchEvent(new CustomEvent('COUNTER_OFFER_RECEIVED', { detail: data }));
            toast({
                title: "New Counter-Offer!",
                description: `Provider proposed a counter-offer of ₹${data.partnerCounterOffer}.`,
                variant: "default",
            });
        });

        newSocket.on("SCHEDULE_PROPOSED", (data) => {
            console.log("Global Socket: Schedule Proposed", data);
            window.dispatchEvent(new CustomEvent('SCHEDULE_PROPOSED', { detail: data }));
            toast({
                title: "New Schedule Proposed",
                description: `Provider proposed a new time: ${data.date} at ${data.time}.`,
                variant: "default",
            });
        });

        newSocket.on("SCHEDULE_ACCEPTED", (data) => {
            console.log("Global Socket: Schedule Accepted", data);
            setScheduleAcceptedData(data);
        });

        newSocket.on("BOOKING_REMINDER", (data) => {
            console.log("Global Socket: Booking Reminder", data);
            setReminderData(data);
        });

        newSocket.on("WALLET_UPDATED", (data) => {
            console.log("Global Socket: Wallet Updated", data);
            window.dispatchEvent(new CustomEvent('WALLET_UPDATED', { detail: data }));
        });

        newSocket.on("NEW_NOTIFICATION", (data) => {
            console.log("Global Socket: New Notification", data);

            // No sound here — the native/Flutter app owns notification sound.

            // Show toast using sonner
            import('sonner').then(({ toast }) => {
                toast(data.title, {
                    description: data.message,
                    duration: 5000,
                });
            });

            // Dispatch global event for UI components to update badge/list
            window.dispatchEvent(new CustomEvent('NEW_NOTIFICATION', { detail: data }));
        });

        newSocket.on("NEW_SOS_ALERT", (data) => {
            console.log("Global Socket: New SOS Alert received", data);
            const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor');
            if (isAdmin) {
                setActiveSosAlerts(prev => {
                    if (prev.some(alert => alert._id === data._id)) return prev;
                    return [data, ...prev];
                });
                setUnreadSosCount(prev => prev + 1);
                setActiveSosAlert(data);
                playAlarmSound();

                // Dispatch global event to force-refresh notification list/count
                window.dispatchEvent(new CustomEvent('NEW_NOTIFICATION', { detail: data }));
            }
        });

        newSocket.on("NEW_WITHDRAWAL_REQUEST", (data) => {
            console.log("Global Socket: New Withdrawal Request received", data);
            const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor');
            if (isAdmin) {
                // Only increment if not currently viewing withdrawals page
                if (window.location.pathname !== "/admin/withdrawals") {
                    setPendingWithdrawalsCount(prev => prev + 1);
                }
                import('sonner').then(({ toast }) => {
                    toast.success("💰 New Payout Request", {
                        description: `${data.providerName || 'Partner'} requested a withdrawal of ₹${data.amount}`,
                        duration: 7000,
                    });
                });
                playAlarmSound();

                // Dispatch global event to force-refresh notification list/count
                window.dispatchEvent(new CustomEvent('NEW_NOTIFICATION', { detail: data }));
            }
        });

        newSocket.on("WITHDRAWAL_STATUS_UPDATED", (data) => {
            console.log("Global Socket: Withdrawal status updated", data);
            const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor');
            if (isAdmin) {
                // Refresh updated count
                const fetchPendingWithdrawals = async () => {
                    try {
                        const res = await API.get("/admin/withdrawals");
                        const count = res.data.filter(w => w.status === 'pending').length;
                        setPendingWithdrawalsCount(count);
                    } catch (err) {
                        console.error("Error updating pending withdrawals count:", err);
                    }
                };
                fetchPendingWithdrawals();

                // Dispatch global event to force-refresh notification list/count
                window.dispatchEvent(new CustomEvent('NEW_NOTIFICATION', { detail: data }));
            }
        });

        return () => {
            newSocket.close();
            setSocket(null);
        };
    }, [user ? user._id : null, user ? user.role : null]);

    useEffect(() => {
        const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor');
        if (isAdmin && user.token) {
            const fetchPendingSOS = async () => {
                try {
                    const res = await API.get("/admin/emergency");
                    setActiveSosAlerts(res.data.sosQueue || []);
                } catch (err) {
                    console.error("Error fetching initial SOS alerts:", err);
                }
            };
            const fetchPendingWithdrawals = async () => {
                try {
                    const res = await API.get("/admin/withdrawals");
                    const count = res.data.filter(w => w.status === 'pending').length;
                    setPendingWithdrawalsCount(count);
                } catch (err) {
                    console.error("Error fetching initial pending withdrawals:", err);
                }
            };
            fetchPendingSOS();
            fetchPendingWithdrawals();
        } else {
            setActiveSosAlerts([]);
            setPendingWithdrawalsCount(0);
        }
    }, [user ? user.token : null, user ? user.role : null]);

    useEffect(() => {
        if (socket && user) {
            const joinRooms = () => {
                const isProviderApp = user.role === 'provider' || user.role === 'sewak';
                if (isProviderApp) {
                    socket.emit('join_provider', user._id);
                    console.log('Provider joined socket room:', user._id);
                } else {
                    socket.emit('join_user', user._id);
                    console.log('User joined socket room:', user._id);
                }
            };

            // Join immediately if already connected
            if (socket.connected) {
                joinRooms();
            }

            // Re-join on reconnect
            socket.on('connect', joinRooms);

            return () => {
                socket.off('connect', joinRooms);
            };
        }
    }, [socket, user]);

    return (
        <SocketContext.Provider value={{
            socket,
            incomingRequest,
            setIncomingRequest,
            incomingLeadRequest,
            setIncomingLeadRequest,
            scheduleAcceptedData,
            setScheduleAcceptedData,
            reminderData,
            setReminderData,
            activeSosAlert,
            setActiveSosAlert,
            activeSosAlerts,
            setActiveSosAlerts,
            unreadSosCount,
            clearUnreadSos: () => setUnreadSosCount(0),
            pendingWithdrawalsCount,
            clearWithdrawalsCount: () => setPendingWithdrawalsCount(0),
            playAlarmSound,
            stopAlarmSound,
            alarmSoundPlaying
        }}>
            {children}
        </SocketContext.Provider>
    );
};
