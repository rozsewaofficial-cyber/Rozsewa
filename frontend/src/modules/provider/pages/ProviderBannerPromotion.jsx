import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Crown, Target, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import API from '@/lib/api';
import ProviderTopNav from '../components/ProviderTopNav';
import ProviderBottomNav from '../components/ProviderBottomNav';

const getIcon = (id) => {
  if (id === 'Local') return <MapPin />;
  if (id === 'Premium Top') return <Crown />;
  return <Target />;
};

const ProviderBannerPromotion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [banners, setBanners] = useState([]);
  const [plans, setPlans] = useState([]);
  const [availableDurations, setAvailableDurations] = useState([7, 15, 30]);
  const [showForm, setShowForm] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  
  // Form State
  const [planType, setPlanType] = useState('Local');
  const [durationDays, setDurationDays] = useState(7);
  const [bannerSource, setBannerSource] = useState('Upload Own Banner');
  const [designDescription, setDesignDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  
  // Location States
  const [targetState, setTargetState] = useState('');
  const [targetDistrict, setTargetDistrict] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [targetPincode, setTargetPincode] = useState('');
  
  const [activeSearchField, setActiveSearchField] = useState(null);
  const [mapSuggestions, setMapSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  const [stateSuggestions, setStateSuggestions] = useState([]);
  const INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
    "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
  ];

  const handleStateChange = (e) => {
    const val = e.target.value;
    setTargetState(val);
    if (val.trim().length > 0) {
      const filtered = INDIAN_STATES.filter(s => s.toLowerCase().includes(val.toLowerCase()));
      setStateSuggestions(filtered);
    } else {
      setStateSuggestions([]);
    }
  };

  const selectState = (s) => {
    setTargetState(s);
    setStateSuggestions([]);
  };

  const searchMap = async (val, field) => {
    if (val.trim().length < 3) {
      setMapSuggestions([]);
      return;
    }
    setActiveSearchField(field);
    setIsSearchingLocation(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=in&limit=10&addressdetails=1`);
      const data = await res.json();
      
      // Filter strictly based on the field type
      const filteredData = data.filter(d => {
        if (field === 'district') {
          return ['state_district', 'county', 'district'].includes(d.addresstype);
        }
        if (field === 'city') {
          return !['state', 'country', 'state_district', 'county', 'region', 'postcode'].includes(d.addresstype);
        }
        return true;
      });
      
      setMapSuggestions(filteredData.slice(0, 5));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const searchTimeout = useRef(null);

  const handleFieldChange = (val, field) => {
    if (field === 'state') setTargetState(val);
    if (field === 'district') setTargetDistrict(val);
    if (field === 'city') setTargetCity(val);
    if (field === 'pincode') setTargetPincode(val);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      searchMap(val, field);
    }, 600);
  };

  const selectMapSuggestion = (s) => {
    if (activeSearchField === 'state') setTargetState(s.address?.state || s.name || s.display_name.split(',')[0]);
    if (activeSearchField === 'district') setTargetDistrict(s.address?.state_district || s.address?.county || s.name || s.display_name.split(',')[0]);
    if (activeSearchField === 'city') setTargetCity(s.address?.city || s.address?.town || s.address?.village || s.name || s.display_name.split(',')[0]);
    if (activeSearchField === 'pincode') setTargetPincode(s.address?.postcode || s.name || s.display_name.split(',')[0]);
    setMapSuggestions([]);
    setActiveSearchField(null);
  };

  useEffect(() => {
    fetchBanners();
    fetchPlans();
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const res = await API.get('/wallet');
      if (res.data && typeof res.data.availableBalance !== 'undefined') {
        setWalletBalance(res.data.availableBalance);
      }
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await API.get('/provider/banner-plans');
      const { data } = res;
      setPlans(data.plans || []);
      setAvailableDurations(data.durations && data.durations.length > 0 ? data.durations : [7]);
      
      if (data.plans && data.plans.length > 0) {
        setPlanType(data.plans[0].id);
      }
      const durations = data.durations || [7];
      if (durations.length > 0 && !durations.includes(durationDays)) {
        setDurationDays(durations[0]);
      }
    } catch (error) {
      console.error("Failed to fetch plans", error);
    }
  };

  const fetchBanners = async () => {
    try {
      const res = await API.get('/provider/banners');
      setBanners(res.data.banners || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    setLoading(true);
    try {
      const res = await API.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImageUrl(res.data.url);
      toast({ title: 'Success', description: 'Image uploaded successfully!' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload image.' });
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = () => {
    const basePlan = plans.find(p => p.id === planType);
    return basePlan ? basePlan.price : 0;
  };

  const isFormValid = () => {
    if (planType === 'State' && !targetState.trim()) return false;
    if (planType === 'District' && !targetDistrict.trim()) return false;
    if (planType === 'City' && !targetCity.trim()) return false;
    if (planType === 'Local' && !targetPincode.trim()) return false;
    
    if (!imageUrl && !designDescription.trim()) return false;
    return true;
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Determine locationValue based on user profile and plan
    let locationValue = '';
    if (planType === 'Premium Top') locationValue = 'ALL';
    else if (planType === 'State') locationValue = targetState;
    else if (planType === 'District') locationValue = targetDistrict;
    else if (planType === 'City') locationValue = targetCity;
    else if (planType === 'Local') locationValue = targetPincode;

    if (!locationValue) {
      setLoading(false);
      return toast({ variant: 'destructive', title: 'Location Missing', description: `Please enter the target ${planType} for your promotion.` });
    }

    if (!imageUrl && !designDescription.trim()) {
      setLoading(false);
      return toast({ variant: 'destructive', title: 'Details Missing', description: `Please either upload a banner image or write a design description.` });
    }

    const finalBannerSource = imageUrl ? 'Upload Own Banner' : 'Create Banner by RozSewa';
    const totalAmount = Math.round(calculatePrice() * 1.18);

    const res = await loadRazorpay();
    if (!res) {
      setLoading(false);
      return toast({ title: "Razorpay SDK failed to load. Are you online?", variant: "destructive" });
    }

    try {
      // 1. Create order
      const { data: order } = await API.post("/payment/order", {
        amount: totalAmount,
        currency: "INR",
      });

      // 2. Setup Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_8sYbzHWidwe5Zw",
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa Banner Promotion",
        description: `${planType} Plan for ${durationDays} days`,
        order_id: order.id,
        handler: async function (response) {
          try {
            let locVal = 'ALL';
            if (planType === 'State') locVal = targetState;
            if (planType === 'District') locVal = targetDistrict;
            if (planType === 'City') locVal = targetCity;
            if (planType === 'Local') locVal = targetPincode;

            const payload = {
              planType,
              locationValue: locVal,
              targetState,
              targetDistrict,
              targetCity,
              targetPincode,
              durationDays,
              bannerSource,
              designDescription,
              imageUrl,
              pricePaid: calculatePrice(),
              paymentId: response.razorpay_payment_id
            };

            await API.post('/provider/banners', payload);
            toast({ title: 'Success', description: 'Banner promotion request submitted!' });
            setShowForm(false);
            fetchBanners();
          } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Payment succeeded but banner request failed. Contact Support.' });
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.mobile,
        },
        theme: { color: "#10b981" },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", function (response) {
        toast({ title: "Payment Failed", description: response.error.description, variant: "destructive" });
      });
      paymentObject.open();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to initiate payment.' });
    } finally {
      setLoading(false);
    }
  };

  const handleWalletSubmit = async () => {
    setLoading(true);
    
    // Determine locationValue based on user profile and plan
    let locationValue = '';
    if (planType === 'Premium Top') locationValue = 'ALL';
    else if (planType === 'State') locationValue = targetState;
    else if (planType === 'District') locationValue = targetDistrict;
    else if (planType === 'City') locationValue = targetCity;
    else if (planType === 'Local') locationValue = targetPincode;

    if (!locationValue) {
      setLoading(false);
      return toast({ variant: 'destructive', title: 'Location Missing', description: `Please enter the target ${planType} for your promotion.` });
    }

    if (!imageUrl && !designDescription.trim()) {
      setLoading(false);
      return toast({ variant: 'destructive', title: 'Details Missing', description: `Please either upload a banner image or write a design description.` });
    }

    const finalBannerSource = imageUrl ? 'Upload Own Banner' : 'Create Banner by RozSewa';
    const totalAmount = Math.round(calculatePrice() * 1.18);

    try {
      await API.post("/provider/banners/wallet", {
        planType,
        locationValue,
        durationDays,
        bannerSource: finalBannerSource,
        designDescription,
        imageUrl,
        pricePaid: totalAmount
      });
      
      toast({ title: 'Success', description: 'Banner promotion request submitted using wallet!' });
      setShowForm(false);
      fetchBanners();
      fetchWalletBalance();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Payment Failed', description: error.response?.data?.message || 'Could not process wallet payment.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <ProviderTopNav title="Banner Promotions" onBack={() => showForm ? setShowForm(false) : navigate('/provider')} />
      
      <div className="p-4 max-w-md mx-auto">
        {!showForm ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-lg">
              <h2 className="text-xl font-black mb-2">Boost Your Business! 🚀</h2>
              <p className="text-sm opacity-90 mb-4">Get featured at the top of search results and home page to increase your orders.</p>
              <button onClick={() => setShowForm(true)} className="bg-white text-blue-600 font-bold px-6 py-2.5 rounded-full text-sm w-full">
                Promote Now
              </button>
            </div>

            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-widest text-xs">My Promotions</h3>
              {banners.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-center border border-slate-200 dark:border-slate-800">
                  <Target className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500">No active promotions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {banners.map(banner => (
                    <div key={banner._id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-sm">{banner.planType} Plan</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${banner.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : banner.status === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {banner.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{banner.durationDays} Days • {banner.locationValue}</p>
                      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="text-center">
                          <p className="text-[10px] uppercase text-slate-400 font-bold">Views</p>
                          <p className="font-black text-sm">{banner.analytics?.views || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase text-slate-400 font-bold">Clicks</p>
                          <p className="font-black text-sm">{banner.analytics?.clicks || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] uppercase text-slate-400 font-bold">Orders</p>
                          <p className="font-black text-sm">{banner.analytics?.orders || 0}</p>
                        </div>
                      </div>
                      {banner.status === 'Expired' && (
                        <button onClick={() => setShowForm(true)} className="w-full mt-3 bg-blue-50 text-blue-600 font-bold py-2 rounded-xl text-xs">
                          Renew Banner
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Select Plan</label>
              <div className="space-y-3">
                {plans.map(plan => (
                  <label key={plan.id} className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${planType === plan.id ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'}`}>
                    <input type="radio" name="planType" value={plan.id} checked={planType === plan.id} onChange={(e) => setPlanType(e.target.value)} className="hidden" />
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${planType === plan.id ? 'bg-blue-500 text-white shadow-inner' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {getIcon(plan.id)}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-slate-900 dark:text-white">{plan.title}</p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{plan.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-blue-600 dark:text-blue-400">₹{plan.price}</p>
                      <p className="text-[9px] text-slate-400 uppercase">/{availableDurations[0] || 7} Days</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {planType !== 'Premium Top' && (
              <div className="space-y-4">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Target Location Details</label>
                <div className="grid grid-cols-1 gap-4">
                  {planType === 'State' && (
                  <div className="relative">
                    <input type="text" value={targetState} onChange={handleStateChange} onFocus={() => targetState.length > 0 && setStateSuggestions(INDIAN_STATES.filter(s => s.toLowerCase().includes(targetState.toLowerCase())))} onBlur={() => setTimeout(() => setStateSuggestions([]), 200)} placeholder="Enter State (e.g. Delhi)" className="w-full border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-4 text-sm font-bold focus:border-blue-500 outline-none" required />
                    
                    {stateSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                        {stateSuggestions.map((s, i) => (
                          <li key={i} onClick={() => selectState(s)} className="p-3 text-xs font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors">
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  )}
                  {planType === 'District' && (
                  <div className="relative">
                    <input type="text" value={targetDistrict} onChange={(e) => handleFieldChange(e.target.value, 'district')} onFocus={() => setMapSuggestions([])} placeholder="Enter District" className="w-full border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-4 text-sm font-bold focus:border-blue-500 outline-none" required />
                    {activeSearchField === 'district' && isSearchingLocation && <div className="absolute right-4 top-4"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>}
                    {activeSearchField === 'district' && mapSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                        {mapSuggestions.map((s, i) => (
                          <li key={i} onClick={() => selectMapSuggestion(s)} className="p-3 text-xs font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors">
                            {s.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  )}
                  {planType === 'City' && (
                  <div className="relative">
                    <input type="text" value={targetCity} onChange={(e) => handleFieldChange(e.target.value, 'city')} onFocus={() => setMapSuggestions([])} placeholder="Enter City (e.g. New Delhi)" className="w-full border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-4 text-sm font-bold focus:border-blue-500 outline-none" required />
                    {activeSearchField === 'city' && isSearchingLocation && <div className="absolute right-4 top-4"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>}
                    {activeSearchField === 'city' && mapSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                        {mapSuggestions.map((s, i) => (
                          <li key={i} onClick={() => selectMapSuggestion(s)} className="p-3 text-xs font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors">
                            {s.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  )}
                  {planType === 'Local' && (
                  <div className="relative">
                    <input type="text" maxLength={6} pattern="\d{6}" value={targetPincode} onChange={(e) => setTargetPincode(e.target.value.replace(/\D/g, ''))} placeholder="Enter 6-digit PIN Code (e.g. 110001)" className="w-full border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-4 text-sm font-bold focus:border-blue-500 outline-none" required />
                  </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Duration</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {availableDurations.map(days => (
                  <div key={days} className={`py-3 rounded-xl border-2 font-black text-sm text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${durationDays === days ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}`} onClick={() => setDurationDays(days)}>
                    <span className="flex items-center gap-2">
                      {durationDays === days && <CheckCircle2 className="w-4 h-4" />} {days} Days
                    </span>
                    {availableDurations.length === 1 && <span className="text-[10px] text-blue-500 font-bold uppercase">(Fixed Duration)</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Banner Design / Requirement</label>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 relative">
                   <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                   
                   {imageUrl ? (
                     <div className="relative w-full h-32">
                       <img src={imageUrl} alt="Uploaded Banner" className="w-full h-full object-cover rounded-xl" />
                     </div>
                   ) : (
                     <>
                       <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                       <p className="text-xs font-bold text-slate-600">Upload Banner Image (Optional)</p>
                       <p className="text-[10px] text-slate-500 mt-1">Recommended size: 1200x600px</p>
                     </>
                   )}
                </div>

                <div className="text-center text-xs font-black text-slate-400">OR</div>

                <div>
                  <textarea rows={4} value={designDescription} onChange={e => setDesignDescription(e.target.value)} placeholder="If you don't have an image, describe what you want on the banner (e.g. Special 50% discount on AC repair...)" className="w-full border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl p-4 text-xs font-medium focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2 shadow-xl">
              <div className="flex justify-between text-xs font-medium opacity-80">
                <span>{planType} Plan ({durationDays} Days)</span>
                <span>₹{calculatePrice()}</span>
              </div>
              <div className="flex justify-between text-xs font-medium opacity-80">
                <span>GST (18%)</span>
                <span>₹{Math.round(calculatePrice() * 0.18)}</span>
              </div>
              <div className="border-t border-slate-700 my-2 pt-2 flex justify-between font-black text-lg">
                <span>Total Payload</span>
                <span className="text-emerald-400">₹{Math.round(calculatePrice() * 1.18)}</span>
              </div>
              <button type="submit" disabled={loading || !isFormValid()} className="w-full bg-emerald-500 text-white font-black py-4 rounded-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Pay & Submit Request'}
              </button>
              
              <button 
                type="button" 
                onClick={handleWalletSubmit} 
                disabled={loading || !isFormValid() || walletBalance < Math.round(calculatePrice() * 1.18)} 
                className={`w-full text-white font-black py-4 rounded-xl mt-2 flex items-center justify-center gap-2 transition-all ${walletBalance >= Math.round(calculatePrice() * 1.18) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed opacity-80'}`}
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                  walletBalance >= Math.round(calculatePrice() * 1.18) 
                    ? `Pay with Wallet (Bal: ₹${walletBalance})` 
                    : `Insufficient Wallet Balance (₹${walletBalance})`
                )}
              </button>
            </div>
          </form>
        )}
      </div>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderBannerPromotion;
