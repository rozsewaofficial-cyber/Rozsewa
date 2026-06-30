import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import api from '@/lib/api';

const BazaarAdDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdDetails();
  }, [id]);

  const fetchAdDetails = async () => {
    try {
      const res = await api.get(`/bazaar/live/${id}`);
      if (res.data.success) {
        setAd(res.data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 rounded-full text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-slate-800 line-clamp-1 flex-1">{ad.title}</h1>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Images */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {ad.images?.map((img, i) => (
            <img key={i} src={img} alt="" className="h-48 w-48 object-cover rounded-xl shrink-0" />
          ))}
        </div>

        {/* Details */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-3xl font-black text-blue-600 mb-2">₹{ad.price}</p>
          <div className="flex items-center gap-2 mb-4">
             <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">{ad.category}</span>
             <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">{ad.condition}</span>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{ad.description}</p>
        </div>

        {/* Seller Info */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
             <span className="text-xl font-bold text-blue-600">{ad.sellerId?.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="font-bold text-slate-800">{ad.sellerId?.name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {ad.location?.areaName}, {ad.location?.city}
            </p>
          </div>
        </div>

      </div>
      
      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 max-w-2xl mx-auto">
        <button
          onClick={() => navigate(`/bazaar/${ad._id}/offer`)}
          className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg text-lg"
        >
          Make an Offer
        </button>
      </div>
    </div>
  );
};

export default BazaarAdDetails;
