import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

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
    const { user } = useAuth();

    // Alarm Sound Player Management
    const [alarmSoundPlaying, setAlarmSoundPlaying] = useState(false);
    const alarmAudioRef = React.useRef(null);

    const playAlarmSound = () => {
        if (alarmAudioRef.current) {
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
                playAlarmSound();
            }
        });

        newSocket.on("NEW_LEAD_REQUEST", (data) => {
            console.log("Global Socket: New lead received", data);
            sessionStorage.setItem('activeLeadRequest', JSON.stringify(data));
            setIncomingLeadRequest(data);
            
            const path = window.location.pathname;
            if (path.startsWith('/provider') || path.startsWith('/sewak')) {
                playAlarmSound();
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

        return () => {
            newSocket.close();
            setSocket(null);
        };
    }, [user ? user._id : null]);

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
            playAlarmSound,
            stopAlarmSound,
            alarmSoundPlaying
        }}>
            {children}
        </SocketContext.Provider>
    );
};
