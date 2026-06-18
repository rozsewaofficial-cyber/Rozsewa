import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

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
    const [scheduleAcceptedData, setScheduleAcceptedData] = useState(null);
    const [reminderData, setReminderData] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
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
        });

        newSocket.on("BOOKING_TAKEN", (data) => {
            setIncomingRequest(prev => {
                if (prev && prev.bookingId === data.bookingId) {
                    sessionStorage.removeItem('activeRequest');
                    return null;
                }
                return prev;
            });
        });

        newSocket.on("BOOKING_REJECTED", (data) => {
            console.log("Global Socket: Booking rejected", data);
            window.dispatchEvent(new CustomEvent('BOOKING_REJECTED', { detail: data }));
        });

        newSocket.on("SCHEDULE_ACCEPTED", (data) => {
            console.log("Global Socket: Schedule Accepted", data);
            setScheduleAcceptedData(data);
        });

        newSocket.on("BOOKING_REMINDER", (data) => {
            console.log("Global Socket: Booking Reminder", data);
            setReminderData(data);
        });

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        if (socket && user) {
            if (user.role === 'provider' || user.role === 'sewak' || user.providerCategory) {
                socket.emit('join_provider', user._id);
                console.log('Provider joined socket room:', user._id);
            } else {
                socket.emit('join_user', user._id);
                console.log('User joined socket room:', user._id);
            }
        }
    }, [socket, user]);

    return (
        <SocketContext.Provider value={{ socket, incomingRequest, setIncomingRequest, scheduleAcceptedData, setScheduleAcceptedData, reminderData, setReminderData }}>
            {children}
        </SocketContext.Provider>
    );
};
