import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, ChevronRight, Check } from 'lucide-react';
import API from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import AuthContext from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const ChatModal = ({ isOpen, onClose, bookingId, userType }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [offerAmount, setOfferAmount] = useState('');
    const [showOfferInput, setShowOfferInput] = useState(false);
    const [activeBookingId, setActiveBookingId] = useState(bookingId);

    useEffect(() => {
        if (bookingId) setActiveBookingId(bookingId);
    }, [bookingId]);

    const messagesEndRef = useRef(null);
    const { socket } = useSocket();
    const { user, provider } = useContext(AuthContext);
    const { toast } = useToast();

    const currentUser = userType === 'Provider' ? provider : user;
    const currentUserId = currentUser?._id;

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
    }, [isOpen, bookingId]);

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
    }, [isOpen, socket, bookingId]);

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

    const handleAcceptOffer = async (amount) => {
        try {
            await API.patch(`/bookings/${activeBookingId}/accept-counter`, { amount });
            toast({ title: "Offer Accepted!", description: `The price has been updated to ₹${amount}` });
            
            // Send a system message via text to confirm
            await API.post(`/chat/${activeBookingId}`, {
                text: `Offer of ₹${amount} was accepted!`,
                type: 'text'
            });
        } catch (error) {
            toast({ title: "Failed to accept offer", variant: "destructive" });
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
            >
                <motion.div 
                    initial={{ y: "100%" }} 
                    animate={{ y: 0 }} 
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="flex w-full h-[85vh] sm:h-[600px] sm:max-w-md flex-col overflow-hidden rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-slate-900 shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-[15px] font-black text-slate-900 dark:text-white">Chat with {userType === 'Provider' ? 'Customer' : 'Provider'}</h3>
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
                                                    {!isMe && userType === 'User' && (
                                                        <button onClick={() => handleAcceptOffer(msg.offerAmount)} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2 text-[12px] font-black text-white hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/20">
                                                            Accept & Update Price
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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
                        
                        <AnimatePresence>
                            {showOfferInput && userType === 'Provider' && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    <div className="flex gap-2 mb-3 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-[16px] border border-amber-200 dark:border-amber-900/30">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                value={offerAmount} 
                                                onChange={(e) => setOfferAmount(e.target.value)} 
                                                placeholder="Enter offer amount..."
                                                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-4 py-2.5 text-sm font-bold focus:border-amber-500 focus:outline-none" 
                                            />
                                        </div>
                                        <button onClick={(e) => handleSendMessage(e, 'offer', offerAmount)} className="rounded-xl bg-amber-500 px-4 py-2 text-[12px] font-black text-white hover:bg-amber-600 shadow-sm">
                                            Send
                                        </button>
                                        <button onClick={() => setShowOfferInput(false)} className="rounded-xl bg-slate-200 dark:bg-slate-700 px-3 text-slate-600 dark:text-slate-300 hover:bg-slate-300">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={(e) => handleSendMessage(e, 'text')} className="flex items-center gap-2">
                            {userType === 'Provider' && !showOfferInput && (
                                <button type="button" onClick={() => setShowOfferInput(true)} className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 hover:bg-amber-100 transition-colors">
                                    Offer
                                </button>
                            )}
                            
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
        </AnimatePresence>
    );
};

export default ChatModal;
