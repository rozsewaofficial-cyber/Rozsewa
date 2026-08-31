import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Phone, MapPin, Lock, Unlock,
  CheckCircle, MessageSquare, ShieldCheck, Eye, Wallet,
  XCircle, Clock
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const BazaarAdDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id || user?.user?._id || user?.user?.id;

  const [ad, setAd] = useState(null);
  // dealState: 'no_offer' | 'pending' | 'countered' | 'deal_locked' | 'rejected'
  const [unlockStatus, setUnlockStatus] = useState({
    isUnlocked: false, fee: 20, isSeller: false, dealState: 'no_offer'
  });
  const [contactDetails, setContactDetails] = useState(null);
  const [hasExistingOffer, setHasExistingOffer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchContactDetails = async () => {
    try {
      const res = await api.get(`/bazaar/unlock/contact/${id}`);
      if (res.data.success) setContactDetails(res.data.data);
    } catch (e) { /* not unlocked yet */ }
  };

  const fetchUnlockStatus = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await api.get(`/bazaar/unlock/status/${id}`);
      if (res.data.success) {
        setUnlockStatus(res.data.data);
        if (res.data.data.isUnlocked && !res.data.data.isSeller) {
          fetchContactDetails();
        }
      }
    } catch (e) { /* not logged in / network error — keep defaults */ }
  }, [id, currentUserId]);

  const fetchAdDetails = useCallback(async () => {
    try {
      const res = await api.get(`/bazaar/live/${id}`);
      if (res.data.success) setAd(res.data.data);

      if (currentUserId) {
        try {
          const offerRes = await api.get(`/bazaar/offer/${id}`);
          if (offerRes.data.success && offerRes.data.data.length > 0) {
            setHasExistingOffer(true);
          }
        } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.error(error);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchAdDetails(), fetchUnlockStatus()]);
      setLoading(false);
    })();
  }, [fetchAdDetails, fetchUnlockStatus]);

  // Wallet-based unlock — only succeeds if server confirms deal_locked
  const handleUnlock = async () => {
    if (!currentUserId) { navigate('/login'); return; }
    setUnlocking(true);
    try {
      const res = await api.post('/bazaar/unlock', { adId: id });
      if (res.data.success) {
        showToast('🎉 Contact unlocked successfully!');
        setContactDetails(res.data.data);
        setUnlockStatus(prev => ({ ...prev, isUnlocked: true }));
      }
    } catch (err) {
      const code = err.response?.status;
      const serverCode = err.response?.data?.code;
      if (serverCode === 'DEAL_NOT_LOCKED') {
        showToast('You can only unlock contact after both parties agree on a price.', true);
      } else if (code === 402) {
        const feeRequired = err.response?.data?.feeRequired || unlockStatus.fee;
        const balance = err.response?.data?.currentBalance || 0;
        showToast(`Insufficient balance (₹${balance}). Need ₹${feeRequired}.`, true);
      } else {
        showToast(err.response?.data?.message || 'Failed to unlock contact', true);
      }
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <h2 className="text-xl font-bold text-gray-800">Ad not found</h2>
        <button onClick={() => navigate('/bazaar')} className="mt-4 text-blue-600 font-medium">Go back to Bazaar</button>
      </div>
    );
  }

  const sellerIdStr = ad?.sellerId?._id?.toString() || ad?.sellerId?.toString();
  const isOwner = !!(currentUserId && sellerIdStr && currentUserId.toString() === sellerIdStr);
  const { isUnlocked, fee, dealState } = unlockStatus;

  // ── Deal-state-aware unlock section ───────────────────────────────────────
  const renderContactSection = () => {
    // Item sold — no further negotiation/unlock possible
    if (ad.status === 'sold') {
      return (
        <div className="bg-slate-100 rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="font-black text-slate-700 text-sm">This item has been sold</p>
            <p className="text-xs text-slate-500 mt-0.5">It's no longer available for offers or contact unlock.</p>
          </div>
        </div>
      );
    }

    // Already paid & unlocked: show full contact
    if (isUnlocked && contactDetails) {
      return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-white" />
            <p className="text-sm font-black text-white">Contact Details Unlocked ✅</p>
          </div>
          <div className="p-4 space-y-3">
            {contactDetails.phone && (
              <a href={`tel:${contactDetails.phone}`}
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-emerald-100 active:scale-[0.98] transition-transform">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold">Seller's Phone</p>
                  <p className="text-base font-black text-slate-900">{contactDetails.phone}</p>
                </div>
                <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">Call</span>
              </a>
            )}
            {(contactDetails.exactAddress || contactDetails.areaName) && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [contactDetails.houseNumber, contactDetails.exactAddress, contactDetails.areaName, contactDetails.city].filter(Boolean).join(', ')
                )}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-emerald-100 active:scale-[0.98] transition-transform"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-500 font-semibold">Exact Location <span className="text-blue-500">(Tap to map)</span></p>
                  <p className="text-sm font-black text-slate-900 truncate">
                    {[contactDetails.houseNumber, contactDetails.exactAddress, contactDetails.areaName].filter(Boolean).join(', ')}
                  </p>
                </div>
              </a>
            )}
          </div>
        </div>
      );
    }

    // Deal accepted by both parties → show pay-to-unlock CTA
    if (dealState === 'deal_locked') {
      return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-white" />
            <p className="text-sm font-black text-white">🤝 Deal Agreed — Unlock Contact Now</p>
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-600 mb-4">
              Both you and the seller agreed on a price. Pay the one-time unlock fee to see their phone number and exact address.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white rounded-xl p-3 border border-indigo-100 flex flex-col items-center text-center gap-1">
                <Phone className="w-4 h-4 text-slate-400" />
                <p className="text-[10px] font-bold text-slate-600">Phone Number</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-indigo-100 flex flex-col items-center text-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                <p className="text-[10px] font-bold text-slate-600">Exact Address</p>
              </div>
            </div>
            <button
              onClick={handleUnlock}
              disabled={unlocking}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {unlocking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Unlock className="w-5 h-5" />}
              Pay ₹{fee} — Unlock Contact
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
              Paid via Wallet · One-time · Permanent unlock
            </p>
          </div>
        </div>
      );
    }

    // Offer sent, waiting for seller's response
    if (dealState === 'pending') {
      return (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-black text-amber-800 text-sm">⏳ Offer Sent — Waiting for Seller</p>
            <p className="text-xs text-amber-700 mt-1">
              Your offer is with the seller. Once they accept, you can pay to unlock their contact details.
            </p>
            <button
              onClick={() => navigate(`/bazaar/${ad._id}/offer`)}
              className="mt-3 px-4 py-2 bg-amber-600 text-white font-bold rounded-xl text-xs inline-block"
            >
              View Offer Chat →
            </button>
          </div>
        </div>
      );
    }

    // Seller sent a counter offer
    if (dealState === 'countered') {
      return (
        <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-black text-orange-800 text-sm">↔ Seller Counter-Offered</p>
            <p className="text-xs text-orange-700 mt-1">
              The seller sent a counter offer. Accept or negotiate further to lock the deal and unlock contact.
            </p>
            <button
              onClick={() => navigate(`/bazaar/${ad._id}/offer`)}
              className="mt-3 px-4 py-2 bg-orange-500 text-white font-bold rounded-xl text-xs inline-block"
            >
              Respond in Chat →
            </button>
          </div>
        </div>
      );
    }

    // Seller rejected the offer
    if (dealState === 'rejected') {
      return (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-black text-red-800 text-sm">Offer Rejected</p>
            <p className="text-xs text-red-600 mt-1">The seller declined your offer. Try making a different price offer.</p>
            <button
              onClick={() => navigate(`/bazaar/${ad._id}/offer`)}
              className="mt-3 px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs inline-block"
            >
              Make New Offer →
            </button>
          </div>
        </div>
      );
    }

    // Default: no offer yet — explain how the flow works
    return (
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">Contact Details Hidden</p>
            <p className="text-xs text-slate-500">Negotiate a price, then unlock the seller's contact.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-blue-100">
          <p className="text-xs font-bold text-slate-600 mb-2">How it works:</p>
          <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
            <li>Tap <strong>Make an Offer</strong> below and enter a price</li>
            <li>Seller accepts → deal locked 🤝</li>
            <li>Pay a small unlock fee (₹{fee}) via wallet</li>
            <li>Seller's phone & address are revealed — transact directly</li>
          </ol>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-36">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white max-w-sm text-center ${toast.isError ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate('/bazaar')} className="p-2 bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-slate-800 line-clamp-1 flex-1">{ad.title}</h1>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Images */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {ad.images?.map((img, i) => (
            <img key={i} src={img} alt="" className="h-52 w-52 object-cover rounded-2xl shrink-0 border border-slate-100 shadow-sm" />
          ))}
        </div>

        {/* Price & Details */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <p className="text-3xl font-black text-blue-600">₹{ad.price?.toLocaleString('en-IN')}</p>
            {ad.isNegotiable && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">Negotiable</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 mb-3 flex-wrap">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{ad.category}</span>
            {ad.subCategory && <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{ad.subCategory}</span>}
            {ad.condition && <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{ad.condition}</span>}
            {ad.brand && <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{ad.brand}</span>}
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{ad.description}</p>
        </div>

        {/* Location (public area only — exact address hidden until unlock) */}
        {ad.location?.city && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 mb-0.5">Listed In</p>
              <p className="font-bold text-slate-800">{ad.location.areaName}, {ad.location.city}</p>
              {ad.location.state && <p className="text-xs text-slate-500">{ad.location.state}</p>}
            </div>
          </div>
        )}

        {/* Seller Info */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xl font-black text-blue-600">{ad.sellerId?.name?.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800">{ad.sellerId?.name || 'Seller'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5" /> Verified Seller
              </span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                Posted {new Date(ad.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* ── Contact / Unlock section (buyer-only, deal-state-aware) ── */}
        {!isOwner && renderContactSection()}

        {/* Owner: see own contact (always visible, no payment needed) */}
        {isOwner && ad.contactDetails?.phone && (
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-700">Your Ad — Your Contact Number</p>
              <p className="font-black text-slate-900">{ad.contactDetails.phone}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Action Bar ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 max-w-2xl mx-auto z-20 space-y-2">
        {isOwner ? (
          <button disabled className="w-full py-4 bg-slate-100 text-slate-400 font-bold rounded-xl cursor-not-allowed uppercase tracking-wide text-sm">
            {ad.status === 'sold' ? 'You Sold This Item' : 'This is Your Ad'}
          </button>
        ) : ad.status === 'sold' ? (
          <button disabled className="w-full py-4 bg-slate-100 text-slate-400 font-bold rounded-xl cursor-not-allowed uppercase tracking-wide text-sm">
            Item No Longer Available
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/bazaar/${ad._id}/offer`)}
              className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {hasExistingOffer ? 'View Offer Chat' : 'Make an Offer'}
            </button>
            {/* Wallet shortcut — useful when balance is low */}
            <button
              onClick={() => navigate('/wallet')}
              title="Top up wallet"
              className="py-4 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition-all"
            >
              <Wallet className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BazaarAdDetails;
