import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [incomingRequest, setIncomingRequest] = useState(() => {
        const saved = sessionStorage.getItem('activeRequest');
        return saved ? JSON.parse(saved) : null;
    });
    const { user } = useAuth();

    useEffect(() => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const socketUrl = API_URL.replace('/api', '');
        const newSocket = io(socketUrl, {
            withCredentials: true,
            transports: ['polling', 'websocket']
        });
        setSocket(newSocket);

        newSocket.on("NEW_BOOKING_REQUEST", (data) => {
            console.log("Global Socket: New booking received", data);
            sessionStorage.setItem('activeRequest', JSON.stringify(data));
            setIncomingRequest(data);
            
            // Play alert sound
            try {
                const audio = new Audio('/sounds/alert.mp3');
                audio.play();
            } catch (err) {
                console.log("Failed to play alert sound:", err);
            }
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

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        if (socket && user) {
            if (user.role === 'provider') {
                socket.emit('join_provider', user._id);
                console.log('Provider joined socket room:', user._id);
            } else {
                socket.emit('join_user', user._id);
                console.log('User joined socket room:', user._id);
            }
        }
    }, [socket, user]);

    return (
        <SocketContext.Provider value={{ socket, incomingRequest, setIncomingRequest }}>
            {children}
        </SocketContext.Provider>
    );
};
