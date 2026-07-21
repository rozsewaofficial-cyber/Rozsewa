import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, ShieldAlert, Unlock, Phone, MapPin, Lock, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';

const BazaarOfferChat = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [ad, setAd] = useState(null);
  const [offerThread, setOfferThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Role-specific chat templates (loaded separately for buyer and seller)
  const [buyerTemplates, setBuyerTemplates] = useState([]);
  const [sellerTemplates, setSellerTemplates] = useState([]);

  // Unlock state
  const [unlockStatus, setUnlockStatus] = useState({ isUnlocked: false, fee: 20 });
  const [contactDetails, setContactDetails] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [numericInput, setNumericInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef(null);

  // Robustly extract user ID from AuthContext
  const currentUserId = user?._id || user?.id || user?.user?._id || user?.user?.id;
  const sellerIdStr = ad?.sellerId?._id?.toString() || ad?.sellerId?.toString();
  const isSeller = !!(currentUserId && sellerIdStr && currentUserId.toString() === sellerIdStr);

  const showToast = (msg, isError = false) => {
    setToastMsg({ msg, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ── Data fetching ────────────────────────────────────────────────────────
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

      // Load buyer and seller templates separately
      const [buyerRes, sellerRes] = await Promise.all([
        api.get('/bazaar/chat-templates?role=buyer'),
        api.get('/bazaar/chat-templates?role=seller')
      ]);
      if (buyerRes.data.success) setBuyerTemplates(buyerRes.data.data.map(t => t.text));
      if (sellerRes.data.success) setSellerTemplates(sellerRes.data.data.map(t => t.text));

      // Load unlock status
      try {
        const unlockRes = await api.get(`/bazaar/unlock/status/${id}`);
        if (unlockRes.data.success) {
          setUnlockStatus(unlockRes.data.data);
          if (unlockRes.data.data.isUnlocked) {
            fetchContactDetails();
          }
        }
      } catch (e) { /* ignore auth errors */ }

    } catch (err) {
      console.error('fetchData error:', err);
      setPageError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContactDetails = async () => {
    try {
      const res = await api.get(`/bazaar/unlock/contact/${id}`);
      if (res.data.success) setContactDetails(res.data.data);
    } catch (e) { /* not unlocked yet */ }
  };

  useEffect(() => { fetchData(); }, [id]);

  // ── Socket + polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const handleOfferUpdated = (payload) => {
      if (payload?.adId === id) fetchData();
    };
    if (socket) socket.on('BAZAAR_OFFER_UPDATED', handleOfferUpdated);
    const pollInterval = setInterval(fetchData, 12000);
    return () => {
      if (socket) socket.off('BAZAAR_OFFER_UPDATED', handleOfferUpdated);
      clearInterval(pollInterval);
    };
  }, [id, socket]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [offerThread]);

  // ── Buyer: send numeric offer ────────────────────────────────────────────
  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!numericInput || isNaN(numericInput) || Number(numericInput) <= 0) return;
    const amount = Number(numericInput);

    // Optimistic update
    setOfferThread(prev => prev
      ? { ...prev, offerHistory: [...(prev.offerHistory || []), { senderId: currentUserId, actionType: 'numeric_offer', numericAmount: amount, createdAt: new Date().toISOString() }] }
      : { offerHistory: [{ senderId: currentUserId, actionType: 'numeric_offer', numericAmount: amount, createdAt: new Date().toISOString() }] }
    );
    setNumericInput('');

    try {
      setIsSubmitting(true);
      await api.post('/bazaar/offer', { adId: id, actionType: 'numeric_offer', numericAmount: amount });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send offer', true);
      fetchData(); // Rollback
    } finally { setIsSubmitting(false); }
  };

  // ── Buyer: send quick-reply template ────────────────────────────────────
  const handleQuickReply = async (msg) => {
    setOfferThread(prev => prev
      ? { ...prev, offerHistory: [...(prev.offerHistory || []), { senderId: currentUserId, actionType: 'predefined_query', predefinedMessage: msg, createdAt: new Date().toISOString() }] }
      : { offerHistory: [{ senderId: currentUserId, actionType: 'predefined_query', predefinedMessage: msg, createdAt: new Date().toISOString() }] }
    );
    try {
      setIsSubmitting(true);
      await api.post('/bazaar/offer', { adId: id, actionType: 'predefined_query', predefinedMessage: msg });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send query', true);
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  // ── Seller: send template reply ──────────────────────────────────────────
  const handleSellerQuickReply = async (msg) => {
    setOfferThread(prev => prev
      ? { ...prev, offerHistory: [...(prev.offerHistory || []), { senderId: currentUserId, actionType: 'predefined_query', predefinedMessage: msg, createdAt: new Date().toISOString() }] }
      : { offerHistory: [{ senderId: currentUserId, actionType: 'predefined_query', predefinedMessage: msg, createdAt: new Date().toISOString() }] }
    );
    try {
      setIsSubmitting(true);
      await api.post('/bazaar/offer', { adId: id, actionType: 'predefined_query', predefinedMessage: msg });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed', true);
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  // ── Seller: accept / reject / counter ───────────────────────────────────
  const handleSellerResponse = async (action) => {
    if (!offerThread) return;
    const amount = Number(numericInput);

    if (action === 'counter') {
      setOfferThread(prev => prev
        ? { ...prev, offerHistory: [...(prev.offerHistory || []), { senderId: currentUserId, actionType: 'numeric_offer', numericAmount: amount, createdAt: new Date().toISOString() }] }
        : prev
      );
      setNumericInput('');
    }

    try {
      setIsSubmitting(true);
      await api.put('/bazaar/offer/respond', {
        offerId: offerThread._id,
        action,
        numericAmount: action === 'counter' ? amount : undefined
      });
      fetchData();
      showToast(`Offer ${action}ed!`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to respond', true);
      fetchData();
    } finally { setIsSubmitting(false); }
  };

  // ── Wallet-based unlock ──────────────────────────────────────────────────
  const handlePayToUnlock = async () => {
    setIsUnlocking(true);
    try {
      const res = await api.post('/bazaar/unlock', {
        adId: id,
        offerId: offerThread?._id || null
      });
      if (res.data.success) {
        showToast('🎉 Contact unlocked successfully!');
        setContactDetails(res.data.data);
        setUnlockStatus(prev => ({ ...prev, isUnlocked: true }));
        // Also update offerThread flag
        setOfferThread(prev => prev ? { ...prev, isLeadUnlockedByBuyer: true } : prev);
      }
    } catch (err) {
      const code = err.response?.status;
      const msg = err.response?.data?.message || 'Failed to unlock';
      if (code === 402) {
        const feeRequired = err.response?.data?.feeRequired || unlockStatus.fee;
        const balance = err.response?.data?.currentBalance || 0;
        showToast(`Insufficient balance (₹${balance}). Need ₹${feeRequired}. Please add money to your wallet.`, true);
      } else {
        showToast(msg, true);
      }
    } finally { setIsUnlocking(false); }
  };

  // ── Loading / Error states ───────────────────────────────────────────────
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
  const isContactUnlocked = unlockStatus.isUnlocked || !!contactDetails;

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative">

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white max-w-xs text-center ${toastMsg.isError ? 'bg-red-500' : 'bg-green-500'}`}>
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 z-10 shrink-0">
        <button onClick={() => navigate(`/bazaar/${id}`)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-slate-900 text-sm line-clamp-1">{ad?.title || 'Bazaar Offer'}</h1>
          <p className="text-xs text-blue-600 font-bold">Asking: ₹{ad?.price?.toLocaleString('en-IN')}</p>
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
          Seller contact is hidden until you pay the unlock fee. Only numeric offers and quick replies are allowed.
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

        {/* Messages */}
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
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">{isMe ? 'Your Price Offer' : 'Offer Received'}</p>
                      <p className="text-2xl font-black tracking-tight">₹{Number(msg.numericAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                  {msg.actionType === 'predefined_query' && (
                    <div>
                      <p className="text-[10px] font-bold opacity-70 mb-0.5">Quick Query</p>
                      <p className="text-sm font-semibold">{msg.predefinedMessage}</p>
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 opacity-60 ${isMe ? 'text-right' : ''}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400 font-medium">No messages yet.</p>
            <p className="text-xs text-slate-400 mt-1">{isSeller ? 'Waiting for a buyer to make an offer.' : 'Start the conversation with an offer or quick reply below.'}</p>
          </div>
        )}
      </div>

      {/* ── Input Area ────────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-slate-100 px-4 py-4 shrink-0">

        {isDealLocked ? (
          /* ── Deal Locked State ──────────────────────────────────────────── */
          <div className="space-y-2">
            <div className="bg-green-50 rounded-2xl p-3 border border-green-100 text-center">
              <p className="text-xs font-bold text-green-700">🔒 Deal Locked at ₹{Number(offerThread?.currentOfferAmount || 0).toLocaleString('en-IN')}</p>
            </div>

            {isContactUnlocked && contactDetails && !isSeller ? (
              /* Contact revealed */
              <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 space-y-2">
                <p className="text-xs font-black text-indigo-800 text-center uppercase tracking-wider flex items-center justify-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Contact Unlocked
                </p>
                {contactDetails.phone && (
                  <a href={`tel:${contactDetails.phone}`} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-100">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold">Phone Number</p>
                      <p className="text-base font-black text-slate-900">{contactDetails.phone}</p>
                    </div>
                  </a>
                )}
                {(contactDetails.exactAddress || contactDetails.areaName) && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [contactDetails.houseNumber, contactDetails.exactAddress, contactDetails.areaName, contactDetails.city].filter(Boolean).join(', ')
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-indigo-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 font-semibold">Pickup Location <span className="text-blue-500">(Tap to map)</span></p>
                      <p className="text-sm font-black text-slate-900 truncate">
                        {[contactDetails.houseNumber, contactDetails.exactAddress, contactDetails.areaName].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </a>
                )}
              </div>
            ) : !isSeller ? (
              /* Buyer: unlock CTA */
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Reveal Seller's Contact</p>
                    <p className="text-[10px] text-slate-500">Pay ₹{unlockStatus.fee} via wallet to see phone & address</p>
                  </div>
                </div>
                <button
                  onClick={handlePayToUnlock}
                  disabled={isUnlocking}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-60"
                >
                  {isUnlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
                  Pay ₹{unlockStatus.fee} — Unlock Contact
                </button>
              </div>
            ) : (
              /* Seller view: waiting */
              <div className="bg-green-50 rounded-2xl p-3 border border-green-100 text-center">
                <p className="text-xs font-bold text-green-700">✅ Deal locked! Buyer will pay the unlock fee to view your contact.</p>
              </div>
            )}
          </div>

        ) : isSeller ? (
          /* ── Seller Input Area ──────────────────────────────────────────── */
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 text-center">
              {offerThread?.status === 'countered'
                ? '⏳ Counter offer sent — Waiting for buyer to accept or make a new offer'
                : 'You are the Seller — Respond to the offer'}
            </p>

            {/* Seller quick reply templates */}
            {sellerTemplates.length > 0 && offerThread?.status !== 'countered' && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {sellerTemplates.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleSellerQuickReply(reply)}
                    disabled={isSubmitting}
                    className="shrink-0 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200 disabled:opacity-40 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleSellerResponse('accept')}
                disabled={isSubmitting || !offerThread || offerThread?.status !== 'pending'}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-40"
              >✓ Accept Offer</button>
              <button
                onClick={() => handleSellerResponse('reject')}
                disabled={isSubmitting || !offerThread || offerThread?.status === 'rejected' || offerThread?.status === 'deal_locked'}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm disabled:opacity-40"
              >✗ Reject</button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={numericInput}
                onChange={e => setNumericInput(e.target.value.slice(0, 8))}
                disabled={isSubmitting || offerThread?.status === 'countered'}
                placeholder={offerThread?.status === 'countered' ? 'Waiting for buyer...' : 'Counter offer amount...'}
                className="flex-1 bg-slate-100 rounded-xl pl-4 pr-4 py-3 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 font-bold text-sm outline-none disabled:opacity-60"
              />
              <button
                onClick={() => handleSellerResponse('counter')}
                disabled={isSubmitting || !numericInput || offerThread?.status === 'countered'}
                className="bg-orange-500 hover:bg-orange-600 text-white w-12 rounded-xl flex items-center justify-center disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

        ) : (
          /* ── Buyer Input Area ───────────────────────────────────────────── */
          <div className="space-y-3">

            {/* Quick reply templates: only shown AFTER an offer thread exists.
                Server enforces the same rule: predefined_query requires existing offer. */}
            {offerThread && buyerTemplates.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {buyerTemplates.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(reply)}
                    disabled={isSubmitting}
                    className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full border border-slate-200 disabled:opacity-40 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Buyer hasn't made any offer yet: show instructional prompt */}
            {!offerThread && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                <p className="text-xs font-bold text-blue-700">Enter your price offer below to start negotiation.</p>
                <p className="text-[10px] text-blue-500 mt-0.5">Quick-reply messages unlock after you send your first price offer.</p>
              </div>
            )}

            {/* Offer pending seller response notice */}
            {offerThread?.status === 'pending' && (
              <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 text-center">
                <p className="text-xs font-bold text-amber-800">⏳ Waiting for seller to respond</p>
                <p className="text-[10px] text-amber-600 mt-0.5">You can send another offer once the seller responds or counters.</p>
              </div>
            )}

            {/* Accept seller's counter if countered */}
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
                onChange={e => setNumericInput(e.target.value.slice(0, 8))}
                disabled={isSubmitting || offerThread?.status === 'pending'}
                placeholder={
                  offerThread?.status === 'pending'
                    ? 'Waiting for seller response...'
                    : offerThread?.status === 'countered'
                    ? 'Counter with a new amount...'
                    : 'Your offer amount...'
                }
                className="flex-1 bg-slate-100 rounded-xl pl-4 pr-4 py-3 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-slate-800 font-black text-sm outline-none disabled:opacity-60"
              />
              <button
                onClick={handleSendOffer}
                disabled={isSubmitting || !numericInput || offerThread?.status === 'pending'}
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
