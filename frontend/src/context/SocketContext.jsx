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

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        if (socket && user && user.role === 'provider') {
            socket.emit('join_provider', user._id);
            console.log('Provider joined socket room:', user._id);
        }
    }, [socket, user]);

    return (
        <SocketContext.Provider value={{ socket, incomingRequest, setIncomingRequest }}>
            {children}
        </SocketContext.Provider>
    );
};
