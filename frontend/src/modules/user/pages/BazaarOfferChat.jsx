import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, ShieldAlert, Unlock, Delete, Phone, MapPin, Lock } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const BazaarOfferChat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [ad, setAd] = useState(null);
  const [offerThread, setOfferThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [chatTemplates, setChatTemplates] = useState([]);
  const [commissionFee, setCommissionFee] = useState(10);
  const [isPayingFee, setIsPayingFee] = useState(false);
  
  const [numericInput, setNumericInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const scrollRef = useRef(null);

  // Robustly extract user ID from AuthContext, as it might be nested
  const currentUserId = user?._id || user?.id || user?.user?._id || user?.user?.id;
  const sellerIdStr = ad?.sellerId?._id?.toString() || ad?.sellerId?.toString();
  const isSeller = !!(currentUserId && sellerIdStr && currentUserId.toString() === sellerIdStr);

  const handleKeypadTap = (val) => {
    if (val === 'del') {
      setNumericInput(prev => prev.slice(0, -1));
    } else {
      setNumericInput(prev => prev.length < 8 ? prev + val : prev);
    }
  };

  const showToast = (msg, isError = false) => {
    setToastMsg({ msg, isError });
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    // If ad is loaded but we still don't know the user, wait
    if (ad && currentUserId && sellerIdStr) {
      if (currentUserId.toString() === sellerIdStr && ad.status === 'pending_review') {
        showToast("Your ad is under review.", false);
      }
    }
  }, [ad, currentUserId, sellerIdStr]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [offerThread]);

  const fetchData = async () => {
    try {
      setPageError(null);
      const adRes = await api.get(`/bazaar/live/${id}`);
      if (adRes.data.success) setAd(adRes.data.data);

      const searchParams = new URLSearchParams(location.search);
      const targetOfferId = searchParams.get('offerId');
      
      const historyRes = await api.get(`/bazaar/offer/${id}${targetOfferId ? `?offerId=${targetOfferId}` : ''}`);
      if (historyRes.data.success && historyRes.data.data.length > 0) {
        let selectedOffer = historyRes.data.data[0];
        if (targetOfferId) {
          const found = historyRes.data.data.find(o => o._id === targetOfferId);
          if (found) selectedOffer = found;
        }
        setOfferThread(selectedOffer);
      }
      
      const templatesRes = await api.get(`/bazaar/chat-templates`);
      if (templatesRes.data.success) {
        setChatTemplates(templatesRes.data.data.map(t => t.text));
      }

      // Fetch commission fee
      const settingsRes = await api.get('/bazaar/settings');
      if (settingsRes.data.success && settingsRes.data.data?.bazaarCommissionFee !== undefined) {
        setCommissionFee(settingsRes.data.data.bazaarCommissionFee);
      }
    } catch (err) {
      console.error('fetchData error:', err);
      setPageError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Duplicates removed
  
  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!numericInput || isNaN(numericInput) || Number(numericInput) <= 0) return;
    
    const amount = Number(numericInput);
    
    // Optimistic UI Update
    const tempMsg = {
      senderId: currentUserId,
      actionType: 'numeric_offer',
      numericAmount: amount,
      createdAt: new Date().toISOString()
    };
    
    setOfferThread(prev => prev ? {
      ...prev,
      offerHistory: [...(prev.offerHistory || []), tempMsg]
    } : {
      offerHistory: [tempMsg]
    });
    
    setNumericInput(''); 
    setShowKeypad(false);

    try {
      setIsSubmitting(true);
      const res = await api.post('/bazaar/offer', {
        adId: id,
        actionType: 'numeric_offer',
        numericAmount: amount
      });
      if (res.data.success) { 
        fetchData(); 
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send offer', true);
      fetchData(); // Rollback
    } finally { setIsSubmitting(false); }
  };

  const handleQuickReply = async (msg) => {
    // Optimistic UI Update
    const tempMsg = {
      senderId: currentUserId,
      actionType: 'predefined_query',
      predefinedMessage: msg,
      createdAt: new Date().toISOString()
    };
    
    setOfferThread(prev => prev ? {
      ...prev,
      offerHistory: [...(prev.offerHistory || []), tempMsg]
    } : {
      offerHistory: [tempMsg]
    });

    try {
      setIsSubmitting(true);
      const res = await api.post('/bazaar/offer', { adId: id, actionType: 'predefined_query', predefinedMessage: msg });
      if (res.data.success) fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send query', true);
      fetchData(); // Rollback
    } finally { setIsSubmitting(false); }
  };

  const handleSellerResponse = async (action) => {
    if (!offerThread) return;
    
    const amount = Number(numericInput);
    
    // Optimistic UI Update
    if (action === 'counter') {
      const tempMsg = {
        senderId: currentUserId,
        actionType: 'numeric_offer',
        numericAmount: amount,
        createdAt: new Date().toISOString()
      };
      
      setOfferThread(prev => prev ? {
        ...prev,
        offerHistory: [...(prev.offerHistory || []), tempMsg]
      } : prev);
      
      setNumericInput('');
      setShowKeypad(false);
    }

    try {
      setIsSubmitting(true);
      const res = await api.put('/bazaar/offer/respond', {
        offerId: offerThread._id,
        action,
        numericAmount: action === 'counter' ? amount : undefined
      });
      if (res.data.success) {
        fetchData();
        showToast(`Offer ${action}ed!`);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to respond', true);
      fetchData(); // Rollback
    } finally { setIsSubmitting(false); }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePayToUnlock = async () => {
    if (!offerThread) return;
    try {
      setIsPayingFee(true);
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        showToast('Razorpay SDK failed to load. Check your internet connection.', true);
        return;
      }

      // Create Razorpay order
      const orderRes = await api.post('/payment/order', {
        amount: commissionFee,
        currency: 'INR'
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderRes.data.amount,
        currency: 'INR',
        name: 'Rozsewa Bazaar',
        description: `Lead Unlock Fee — ${ad?.title}`,
        order_id: orderRes.data.id,
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/payment/verify-bazaar', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              offerId: offerThread._id
            });
            if (verifyRes.data.success) {
              showToast('🎉 Payment successful! Contact details unlocked.');
              fetchData();
            } else {
              showToast('Payment verification failed. Contact support.', true);
            }
          } catch (e) {
            showToast('Payment verification error.', true);
          }
        },
        prefill: {
          name: user?.name || '',
          contact: user?.mobile || ''
        },
        theme: { color: '#4f46e5' }
      };

      new window.Razorpay(options).open();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to initiate payment', true);
    } finally {
      setIsPayingFee(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500 font-medium">Loading offer chat...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 mb-6">{pageError}</p>
        <button onClick={() => { setLoading(true); fetchData(); }} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl">
          Try Again
        </button>
        <button onClick={() => navigate('/bazaar')} className="mt-3 text-slate-500 text-sm font-medium">Go Back</button>
      </div>
    );
  }

  const isDealLocked = offerThread?.status === 'deal_locked';

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative">

      {/* Toast notification */}
      {toastMsg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white ${toastMsg.isError ? 'bg-red-500' : 'bg-green-500'}`}>
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 z-10 shrink-0">
        <button onClick={() => navigate('/bazaar')} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-slate-900 text-sm line-clamp-1">{ad?.title || 'Bazaar Offer'}</h1>
          <p className="text-xs text-blue-600 font-bold">Asking: ₹{ad?.price}</p>
        </div>
        {offerThread && (
          <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
            offerThread.status === 'deal_locked' ? 'bg-green-100 text-green-700' :
            offerThread.status === 'rejected' ? 'bg-red-100 text-red-700' :
            offerThread.status === 'countered' ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {offerThread.status === 'deal_locked' ? '🔒 Locked' :
             offerThread.status === 'rejected' ? '✗ Rejected' :
             offerThread.status === 'countered' ? '↔ Counter' : '● Active'}
          </span>
        )}
      </div>

      {/* Privacy Banner */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-start gap-2 text-amber-700 shrink-0">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p className="text-[10px] font-semibold leading-tight">
          Contacts are hidden until deal is locked & lead fee is paid. Only numbers and quick replies allowed.
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>

        {/* Ad Preview Card */}
        {ad && (
          <div className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm mb-2">
            {ad.images?.[0] && (
              <img src={ad.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-100" />
            )}
            <div>
              <p className="font-black text-slate-800 text-sm">{ad.title}</p>
              <p className="text-xs text-slate-500">{ad.category} · {ad.condition}</p>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <span className="text-[10px] text-slate-400 bg-slate-100 px-3 py-1 rounded-full font-medium">Offer Thread</span>
        </div>

        {offerThread?.offerHistory?.length > 0 ? (
          offerThread.offerHistory.map((msg, idx) => {
            const isMe = msg.senderId?.toString() === currentUserId?.toString();
            if (msg.actionType === 'system_message') {
              return (
                <div key={idx} className="flex justify-center my-1">
                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold px-3 py-1.5 rounded-full">
                    {msg.predefinedMessage}
                  </span>
                </div>
              );
            }
            return (
              <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-3 rounded-2xl max-w-[75%] shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-slate-800 rounded-bl-md border border-slate-100'}`}>
                  {msg.actionType === 'numeric_offer' && (
                    <div>
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">{isMe ? 'Your Offer' : 'Their Offer'}</p>
                      <p className="text-2xl font-black tracking-tight">₹{Number(msg.numericAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                  {msg.actionType === 'predefined_query' && (
                    <p className="text-sm font-semibold">{msg.predefinedMessage}</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400 font-medium">No offers yet. Start by sending an offer below.</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-100 px-4 py-4 shrink-0">
        {isDealLocked ? (
          <div className="space-y-2">
            {/* Deal Locked Banner */}
            <div className="bg-green-50 rounded-2xl p-3 border border-green-100 text-center">
              <p className="text-xs font-bold text-green-700">🔒 Deal Locked at ₹{Number(offerThread?.currentOfferAmount || 0).toLocaleString('en-IN')}</p>
            </div>

            {/* Already unlocked: Show contact info */}
            {offerThread?.isLeadUnlockedByBuyer && !isSeller ? (
              <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 space-y-3">
                <p className="text-xs font-black text-indigo-800 text-center uppercase tracking-wider">✅ Contact Unlocked</p>
                {(ad?.contactDetails?.phone || offerThread?.sellerContactDetails?.phone) && (
                  <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-100">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">Phone Number</p>
                      <a href={`tel:${ad?.contactDetails?.phone || offerThread?.sellerContactDetails?.phone}`} className="text-base font-black text-slate-900">{ad?.contactDetails?.phone || offerThread?.sellerContactDetails?.phone}</a>
                    </div>
                  </div>
                )}
                {(ad?.location?.city || offerThread?.sellerLocation?.city) && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${offerThread?.sellerLocation?.exactAddress ? offerThread.sellerLocation.exactAddress + ', ' : ''}${ad?.location?.areaName || offerThread?.sellerLocation?.areaName}, ${ad?.location?.city || offerThread?.sellerLocation?.city}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-100 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">Pickup Location <span className="text-blue-500 ml-1">(Tap to map)</span></p>
                      <p className="text-sm font-black text-slate-900">
                        {offerThread?.sellerLocation?.exactAddress ? `${offerThread.sellerLocation.exactAddress}, ` : ''}
                        {ad?.location?.areaName || offerThread?.sellerLocation?.areaName}, {ad?.location?.city || offerThread?.sellerLocation?.city}
                      </p>
                    </div>
                  </a>
                )}
              </div>
            ) : !isSeller ? (
              /* Buyer: Pay to unlock */
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Want to buy this?</p>
                    <p className="text-[10px] text-slate-500">Pay a small fee to unlock the seller's contact & location</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white rounded-xl p-3 border border-indigo-100 text-center">
                    <Phone className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500">Phone Number</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-indigo-100 text-center">
                    <MapPin className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-[10px] text-slate-500">Exact Location</p>
                  </div>
                </div>
                <button
                  onClick={handlePayToUnlock}
                  disabled={isPayingFee}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all"
                >
                  {isPayingFee ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                  Pay ₹{commissionFee} — Unlock Contact & Location
                </button>
              </div>
            ) : (
              /* Seller view: deal done */
              <div className="bg-green-50 rounded-2xl p-3 border border-green-100 text-center">
                <p className="text-xs font-bold text-green-700">✅ Deal locked! Waiting for buyer to complete payment.</p>
              </div>
            )}
          </div>
        ) : isSeller ? (
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 text-center">You are the Seller — Respond to the offer</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSellerResponse('accept')}
                disabled={isSubmitting || !offerThread || offerThread?.status === 'rejected'}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-40"
              >✓ Accept</button>
              <button
                onClick={() => handleSellerResponse('reject')}
                disabled={isSubmitting || !offerThread || offerThread?.status === 'rejected'}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm disabled:opacity-40"
              >✗ Reject</button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={numericInput}
                onChange={(e) => setNumericInput(e.target.value.slice(0, 8))}
                disabled={isSubmitting}
                placeholder="Counter offer..."
                className="relative flex-1 bg-slate-100 rounded-xl pl-4 pr-4 py-3 flex items-center border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 font-bold text-sm outline-none"
              />
              <button onClick={() => handleSellerResponse('counter')} disabled={isSubmitting || !numericInput} className="bg-orange-500 hover:bg-orange-600 text-white w-12 rounded-xl flex items-center justify-center disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Quick Replies (Admin Controlled) */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {chatTemplates.map((reply, i) => (
                <button
                  key={i} onClick={() => handleQuickReply(reply)} disabled={isSubmitting}
                  className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full border border-slate-200 disabled:opacity-40"
                >
                  {reply}
                </button>
              ))}
            </div>

            {offerThread?.status === 'countered' && (
              <div className="flex gap-2 pb-1">
                <button
                  onClick={() => handleSellerResponse('accept')}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-green-500/20 disabled:opacity-40"
                >
                  ✓ Accept Seller's Offer (₹{Number(offerThread.currentOfferAmount).toLocaleString('en-IN')})
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                value={numericInput}
                onChange={(e) => setNumericInput(e.target.value.slice(0, 8))}
                disabled={isSubmitting}
                placeholder="Your offer amount..."
                className="relative flex-1 bg-slate-100 rounded-xl pl-4 pr-4 py-3 flex items-center border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-800 font-black text-sm outline-none"
              />
              <button
                onClick={handleSendOffer}
                disabled={isSubmitting || !numericInput}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl flex items-center justify-center disabled:opacity-40 shadow-md shadow-blue-500/20"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default BazaarOfferChat;
