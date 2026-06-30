import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, ShieldAlert, Unlock, Delete } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const QUICK_REPLIES = [
  'Available?', 'Pickup Only?', 'Bill Available?', 'Warranty?', 'Delivery Possible?', 'Price Negotiable?'
];

const BazaarOfferChat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [ad, setAd] = useState(null);
  const [offerThread, setOfferThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  
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
      if (numericInput.length < 8) setNumericInput(prev => prev + val);
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

      const historyRes = await api.get(`/bazaar/offer/${id}`);
      if (historyRes.data.success && historyRes.data.data.length > 0) {
        setOfferThread(historyRes.data.data[0]);
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
    try {
      setIsSubmitting(true);
      const res = await api.post('/bazaar/offer', {
        adId: id,
        actionType: 'numeric_offer',
        numericAmount: Number(numericInput)
      });
      if (res.data.success) { 
        setNumericInput(''); 
        setShowKeypad(false);
        fetchData(); 
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send offer', true);
    } finally { setIsSubmitting(false); }
  };

  const handleQuickReply = async (msg) => {
    try {
      setIsSubmitting(true);
      const res = await api.post('/bazaar/offer', { adId: id, actionType: 'predefined_query', predefinedMessage: msg });
      if (res.data.success) fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send query', true);
    } finally { setIsSubmitting(false); }
  };

  const handleSellerResponse = async (action) => {
    if (!offerThread) return;
    try {
      setIsSubmitting(true);
      const res = await api.put('/bazaar/offer/respond', {
        offerId: offerThread._id,
        action,
        numericAmount: action === 'counter' ? Number(numericInput) : undefined
      });
      if (res.data.success) {
        if (action === 'counter') {
          setNumericInput('');
          setShowKeypad(false);
        }
        fetchData();
        showToast(`Offer ${action}ed!`);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to respond', true);
    } finally { setIsSubmitting(false); }
  };

  const handleUnlockLead = async () => {
    if (!offerThread) return;
    try {
      setIsSubmitting(true);
      const res = await api.post('/bazaar/lead/unlock', { offerId: offerThread._id });
      if (res.data.success) { showToast('Lead Unlocked! ₹10 deducted.'); fetchData(); }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to unlock lead', true);
    } finally { setIsSubmitting(false); }
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
        <button onClick={() => navigate(-1)} className="mt-3 text-slate-500 text-sm font-medium">Go Back</button>
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
        <button onClick={() => navigate(-1)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0">
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
            const isMe = msg.senderId?.toString() === userId?.toString();
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
            <div className="bg-green-50 rounded-2xl p-3 border border-green-100 text-center">
              <p className="text-xs font-bold text-green-700">🎉 Deal Locked at ₹{Number(offerThread?.currentOfferAmount || 0).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-green-600 mt-0.5">Pay the lead fee to reveal contact info</p>
            </div>
            <button
              onClick={handleUnlockLead}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
              Pay ₹10 — Unlock Contact
            </button>
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
              <div 
                onClick={() => !isSubmitting && setShowKeypad(true)}
                className="relative flex-1 bg-slate-100 rounded-xl pl-7 pr-4 py-3 flex items-center cursor-pointer border border-transparent focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all"
              >
                <span className="text-slate-500 font-bold text-sm mr-1">₹</span>
                <span className={`font-bold text-sm ${numericInput ? 'text-slate-800' : 'text-slate-400'}`}>
                  {numericInput ? Number(numericInput).toLocaleString('en-IN') : 'Counter offer...'}
                </span>
              </div>
              <button onClick={() => handleSellerResponse('counter')} disabled={isSubmitting || !numericInput} className="bg-orange-500 hover:bg-orange-600 text-white w-12 rounded-xl flex items-center justify-center disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Quick Replies */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {QUICK_REPLIES.map((reply, i) => (
                <button
                  key={i} onClick={() => handleQuickReply(reply)} disabled={isSubmitting}
                  className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full border border-slate-200 disabled:opacity-40"
                >
                  {reply}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div 
                onClick={() => !isSubmitting && setShowKeypad(true)}
                className="relative flex-1 bg-slate-100 rounded-xl pl-8 pr-4 py-3 flex items-center cursor-pointer border border-transparent focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
              >
                <span className="text-slate-500 font-bold mr-2">₹</span>
                <span className={`font-black ${numericInput ? 'text-slate-800' : 'text-slate-400'}`}>
                  {numericInput ? Number(numericInput).toLocaleString('en-IN') : 'Your offer amount...'}
                </span>
              </div>
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

      {/* Custom Keypad Modal */}
      {showKeypad && !isDealLocked && (
        <div className="absolute inset-x-0 bottom-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl z-50 p-5 pb-8 animate-in slide-in-from-bottom-full duration-300">
          <div className="flex justify-between items-center mb-6 px-2">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Offer Amount</p>
              <p className="text-3xl font-black text-slate-800">
                ₹{numericInput ? Number(numericInput).toLocaleString('en-IN') : '0'}
              </p>
            </div>
            <button 
              onClick={() => setShowKeypad(false)} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full text-sm"
            >
              Done
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleKeypadTap(num.toString())}
                className="h-14 flex items-center justify-center bg-slate-50 active:bg-slate-200 rounded-2xl text-2xl font-bold text-slate-800 transition-colors"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleKeypadTap('00')}
              className="h-14 flex items-center justify-center bg-slate-50 active:bg-slate-200 rounded-2xl text-xl font-bold text-slate-800 transition-colors"
            >
              00
            </button>
            <button
              onClick={() => handleKeypadTap('0')}
              className="h-14 flex items-center justify-center bg-slate-50 active:bg-slate-200 rounded-2xl text-2xl font-bold text-slate-800 transition-colors"
            >
              0
            </button>
            <button
              onClick={() => handleKeypadTap('del')}
              className="h-14 flex items-center justify-center bg-rose-50 active:bg-rose-100 rounded-2xl text-rose-600 transition-colors"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
          
          <button
            onClick={isSeller ? () => handleSellerResponse('counter') : handleSendOffer}
            disabled={!numericInput || isSubmitting}
            className={`w-full mt-4 h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-lg text-white transition-all shadow-lg ${
              isSeller ? 'bg-orange-500 shadow-orange-500/25 disabled:bg-orange-300' : 'bg-blue-600 shadow-blue-500/25 disabled:bg-blue-300'
            }`}
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            {isSeller ? 'Send Counter Offer' : 'Send Offer'}
          </button>
        </div>
      )}
      
      {/* Backdrop for Keypad */}
      {showKeypad && (
        <div 
          onClick={() => setShowKeypad(false)} 
          className="absolute inset-0 bg-slate-900/20 z-40"
        />
      )}
    </div>
  );
};

export default BazaarOfferChat;
