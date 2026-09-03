import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, ChevronRight, Check } from 'lucide-react';
import API from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import AuthContext from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const ChatModal = ({ isOpen, onClose, bookingId, userType, recipientName }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [offerAmount, setOfferAmount] = useState('');
    const [showOfferInput, setShowOfferInput] = useState(false);
    const [activeBookingId, setActiveBookingId] = useState(bookingId);

    useEffect(() => {
        if (bookingId) setActiveBookingId(bookingId);
    }, [bookingId]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const messagesEndRef = useRef(null);
    const { socket } = useSocket();
    const { user, provider } = useContext(AuthContext);
    const { toast } = useToast();

    const currentUser = userType === 'Provider' ? provider : user;
    const currentUserId = currentUser?._id;

    // Extract recipient name from messages if not passed
    let derivedRecipientName = recipientName;
    if (!derivedRecipientName && messages.length > 0) {
        const otherMsg = messages.find(m => {
            const senderIdStr = m.senderId?._id ? m.senderId._id.toString() : m.senderId?.toString();
            return senderIdStr && senderIdStr !== currentUserId?.toString();
        });
        if (otherMsg) {
            derivedRecipientName = otherMsg.senderName || otherMsg.senderId?.shopName || otherMsg.senderId?.ownerName || otherMsg.senderId?.name;
        }
    }

    // Fetch initial messages
    useEffect(() => {
        if (!isOpen || !activeBookingId) return;

        const fetchMessages = async () => {
            setLoading(true);
            try {
                // Ensure auth headers are passed appropriately based on the userType.
                // Assuming interceptors attach token automatically.
                const { data } = await API.get(`/chat/${activeBookingId}`);
                setMessages(data);
            } catch (error) {
                console.error("Failed to load messages", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [isOpen, activeBookingId]);

    // Socket listeners
    useEffect(() => {
        if (!isOpen || !socket || !activeBookingId) return;

        socket.emit('join_chat_room', activeBookingId);

        const handleReceiveMessage = (newMessage) => {
            setMessages((prev) => [...prev, newMessage]);
        };

        socket.on('receive_message', handleReceiveMessage);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
        };
    }, [isOpen, socket, activeBookingId]);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, showOfferInput]);

    const handleSendMessage = async (e, type = 'text', amount = null) => {
        e?.preventDefault();
        if (type === 'text' && !inputText.trim()) return;
        if (type === 'offer' && (!amount || isNaN(amount))) return;

        try {
            await API.post(`/chat/${activeBookingId}`, {
                text: type === 'text' ? inputText : `Sent an offer for ₹${amount}`,
                type: type,
                offerAmount: amount ? Number(amount) : undefined
            });
            setInputText('');
            setOfferAmount('');
            setShowOfferInput(false);
        } catch (error) {
            toast({ title: "Failed to send message", variant: "destructive" });
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed top-0 left-0 right-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
                style={{ height: 'var(--visual-viewport-height, 100dvh)' }}
                onClick={onClose}
            >
                <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="flex w-full h-full max-h-[85dvh] sm:h-[600px] sm:max-w-md flex-col overflow-hidden rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-[15px] font-black text-slate-900 dark:text-white">Chat with {derivedRecipientName || (userType === 'Provider' ? 'Customer' : 'Provider')}</h3>
                                <p className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="rounded-full p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <span className="animate-pulse text-sm font-bold text-slate-400">Loading messages...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3">
                                    <User className="h-8 w-8 text-blue-300 dark:text-blue-700" />
                                </div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No messages yet</p>
                                <p className="text-[11px] text-slate-400 mt-1">Start the conversation below.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.senderId === currentUserId || msg.senderId?._id === currentUserId;
                                
                                if (msg.type === 'offer') {
                                    return (
                                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className="max-w-[85%] rounded-[20px] bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 shadow-sm overflow-hidden">
                                                <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-b border-amber-100 dark:border-amber-900/50">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                                                        {isMe ? 'You sent an offer' : 'New Offer Received'}
                                                    </p>
                                                </div>
                                                <div className="p-4 flex flex-col items-center justify-center text-center">
                                                    <span className="text-3xl font-black text-slate-900 dark:text-white">₹{msg.offerAmount}</span>
                                                    {/* No in-chat "accept" action here — this offer is informational only.
                                                        Price changes on an active booking go through the extra-charges
                                                        approval flow (Booking.extraCharges), not chat. */}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <span className={`text-[10px] text-slate-500 font-bold mb-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                                            {isMe ? 'You' : (msg.senderId?.name || msg.senderId?.ownerName || (userType === 'Provider' ? 'Customer' : 'Provider'))}
                                        </span>
                                        <div className={`max-w-[80%] rounded-[20px] px-4 py-3 text-[14px] ${isMe ? 'bg-blue-600 text-white rounded-br-[5px]' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-[5px] shadow-sm'}`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        
                        {/* Quick Suggestions */}
                        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide no-scrollbar -mx-2 px-2">
                            {(userType === 'Provider' 
                                ? ["I'm on my way!", "Running 10 mins late", "Please share exact location", "Arrived at your location"]
                                : ["When will you arrive?", "Please call me", "Can we reschedule?", "I'm at the location"]
                            ).map((suggestion, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setInputText(suggestion)}
                                    className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={(e) => handleSendMessage(e, 'text')} className="flex items-center gap-2">
                            
                            <input 
                                type="text" 
                                value={inputText} 
                                onChange={(e) => setInputText(e.target.value)} 
                                placeholder="Type your message..."
                                className="flex-1 h-11 rounded-[16px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400" 
                            />
                            
                            <button type="submit" disabled={!inputText.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-sm">
                                <Send className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default ChatModal;
