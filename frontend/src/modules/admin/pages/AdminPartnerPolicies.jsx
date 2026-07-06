import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import API from '@/lib/api';
import { Save, Loader2, ShieldCheck, Gift, Award, Heart, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { normalizeNonNegativeNumber } from '@/lib/numberValidation';

export default function AdminPartnerPolicies() {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  
  const [policy, setPolicy] = useState({
    welcomeOffer: { freeServicesCount: 3 },
    performanceDiscounts: [{ ordersCount: 20, discountPercent: 1 }],
    starRatingRewards: {
        silver: { minRating: 4.5, durationMonths: 6, bonusPercent: 1 },
        gold: { minRating: 4.8, durationMonths: 12, bonusPercent: 2 }
    },
    loyaltyRewards: [{ bookingsCount: 100, bonusType: 'cash', bonusAmount: 1000, giftDescription: '' }],
    surakshaNidhi: { enabled: true, minDeduction: 1, maxDeduction: 2 },
    noWorkProtectionMonths: 3,
    referralBonus: { firstOrderBonus: 200, milestoneOrders: 20, milestoneBonus: 300 },
    repeatCustomerReward: { repeatBookings: 10, bonusAmount: 200 }
  });

  useEffect(() => {
    setTitle("Category Policies");
    fetchCategories();
  }, [setTitle]);

  useEffect(() => {
    if (selectedCategories.length === 1) {
      fetchPolicy(selectedCategories[0]);
    } else if (selectedCategories.length === 0) {
      setPolicy({
        welcomeOffer: { freeServicesCount: 3 },
        performanceDiscounts: [{ ordersCount: 20, discountPercent: 1 }],
        starRatingRewards: {
            silver: { minRating: 4.5, durationMonths: 6, bonusPercent: 1 },
            gold: { minRating: 4.8, durationMonths: 12, bonusPercent: 2 }
        },
        loyaltyRewards: [{ bookingsCount: 100, bonusType: 'cash', bonusAmount: 1000, giftDescription: '' }],
        surakshaNidhi: { enabled: true, minDeduction: 1, maxDeduction: 2 },
        noWorkProtectionMonths: 3,
        referralBonus: { firstOrderBonus: 200, milestoneOrders: 20, milestoneBonus: 300 },
        repeatCustomerReward: { repeatBookings: 10, bonusAmount: 200 }
      });
    }
  }, [selectedCategories]);

  const fetchCategories = async () => {
    try {
      const { data } = await API.get('/admin/categories');
      setCategories(data);
      if (data.length > 0) {
        setSelectedCategories([data[0]._id]);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      toast({ title: 'Failed to load categories', variant: 'destructive' });
    }
  };

  const fetchPolicy = async (categoryId) => {
    setLoading(true);
    try {
      const { data } = await API.get(`/admin/partner-policies?category=${categoryId}`);
      if (data.success && data.data.length > 0) {
        const fetchedPolicy = data.data[0];
        setPolicy({
          ...policy,
          ...fetchedPolicy,
          performanceDiscounts: fetchedPolicy.performanceDiscounts?.length ? fetchedPolicy.performanceDiscounts : policy.performanceDiscounts,
          loyaltyRewards: fetchedPolicy.loyaltyRewards?.length ? fetchedPolicy.loyaltyRewards : policy.loyaltyRewards,
        });
      } else {
        // Reset to default for this category if not found
        setPolicy({
            welcomeOffer: { freeServicesCount: 3 },
            performanceDiscounts: [{ ordersCount: 20, discountPercent: 1 }],
            starRatingRewards: {
                silver: { minRating: 4.5, durationMonths: 6, bonusPercent: 1 },
                gold: { minRating: 4.8, durationMonths: 12, bonusPercent: 2 }
            },
            loyaltyRewards: [{ bookingsCount: 100, bonusType: 'cash', bonusAmount: 1000, giftDescription: '' }],
            surakshaNidhi: { enabled: true, minDeduction: 1, maxDeduction: 2 },
            noWorkProtectionMonths: 3,
            referralBonus: { firstOrderBonus: 200, milestoneOrders: 20, milestoneBonus: 300 },
            repeatCustomerReward: { repeatBookings: 10, bonusAmount: 200 }
        });
      }
    } catch (err) {
      toast({ title: 'Failed to load policy for category', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      toast({ title: 'Please select at least one category', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await API.post('/admin/partner-policies', { ...policy, categories: selectedCategories });
      toast({ title: 'Category Policy Saved Successfully!' });
      if (selectedCategories.length === 1) fetchPolicy(selectedCategories[0]);
    } catch (err) {
      toast({ title: 'Failed to save policy', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleNestedChange = (section, field, value) => {
    setPolicy(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleDeepNestedChange = (section, subsection, field, value) => {
    setPolicy(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [field]: value
        }
      }
    }));
  };

  const handleArrayNestedChange = (section, index, field, value) => {
    setPolicy(prev => {
      const newArray = [...prev[section]];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [section]: newArray };
    });
  };

  if (loading && categories.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" /> Category-Wise Partner Policies
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage unique rewards, welfare, and operational rules for each category.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="min-w-[250px] relative group cursor-pointer">
            <div className="w-full border-2 border-emerald-100 bg-emerald-50/50 p-2.5 rounded-lg text-sm font-bold text-emerald-800 outline-none focus:border-emerald-300 flex justify-between items-center">
               <span>{selectedCategories.length === 0 ? 'Select Categories' : selectedCategories.length === 1 ? categories.find(c => c._id === selectedCategories[0])?.name : `${selectedCategories.length} Categories Selected`}</span>
               <span className="text-emerald-600">▼</span>
            </div>
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover:block max-h-60 overflow-y-auto">
               <label className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-100">
                   <input type="checkbox" checked={selectedCategories.length === categories.length && categories.length > 0} onChange={(e) => setSelectedCategories(e.target.checked ? categories.map(c => c._id) : [])} className="rounded text-emerald-600 focus:ring-emerald-500" />
                   Select All
               </label>
               {categories.map(c => (
                   <label key={c._id} className="flex items-center gap-2 p-3 hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-700">
                       <input 
                          type="checkbox" 
                          checked={selectedCategories.includes(c._id)} 
                          onChange={() => setSelectedCategories(prev => prev.includes(c._id) ? prev.filter(id => id !== c._id) : [...prev, c._id])} 
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                       />
                       {c.name}
                   </label>
               ))}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading || selectedCategories.length === 0}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save Policy
          </button>
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Welcome Offer */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Gift className="h-5 w-5 text-indigo-500" /> Welcome Offer</h2>
                <div>
                    <label className="text-xs font-bold text-slate-500">Free Services (No Commission)</label>
                    <input 
                        type="text" 
                        inputMode="numeric"
                        value={policy.welcomeOffer?.freeServicesCount || 0}
                        onChange={e => handleNestedChange('welcomeOffer', 'freeServicesCount', normalizeNonNegativeNumber(e.target.value))}
                        className="w-full border p-2.5 rounded-lg mt-1 outline-emerald-500 text-sm max-w-xs"
                    />
                </div>
            </div>

            {/* Performance Rewards */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Award className="h-5 w-5 text-amber-500" /> Performance & Star Ratings</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 border-b pb-2">Order-Based Discount</h3>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Orders Required</label>
                            <input 
                                type="text" inputMode="numeric"
                                value={policy.performanceDiscounts[0]?.ordersCount || 0}
                                onChange={e => handleArrayNestedChange('performanceDiscounts', 0, 'ordersCount', normalizeNonNegativeNumber(e.target.value))}
                                className="w-full border p-2 rounded-lg mt-1 outline-emerald-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">Discount Percent (%)</label>
                            <input 
                                type="text" inputMode="decimal"
                                value={policy.performanceDiscounts[0]?.discountPercent || 0}
                                onChange={e => handleArrayNestedChange('performanceDiscounts', 0, 'discountPercent', normalizeNonNegativeNumber(e.target.value))}
                                className="w-full border p-2 rounded-lg mt-1 outline-emerald-500 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 border-b pb-2">Star Rating Bonus</h3>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Silver Min Rating</label>
                                <input 
                                    type="text" inputMode="decimal"
                                    value={policy.starRatingRewards?.silver?.minRating || 0}
                                    onChange={e => handleDeepNestedChange('starRatingRewards', 'silver', 'minRating', normalizeNonNegativeNumber(e.target.value))}
                                    className="w-full border p-1.5 rounded text-sm mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Silver Bonus (%)</label>
                                <input 
                                    type="text" inputMode="decimal"
                                    value={policy.starRatingRewards?.silver?.bonusPercent || 0}
                                    onChange={e => handleDeepNestedChange('starRatingRewards', 'silver', 'bonusPercent', normalizeNonNegativeNumber(e.target.value))}
                                    className="w-full border p-1.5 rounded text-sm mt-1"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-amber-50 p-3 rounded-lg border border-amber-100">
                            <div>
                                <label className="text-xs font-bold text-amber-700">Gold Min Rating</label>
                                <input 
                                    type="text" inputMode="decimal"
                                    value={policy.starRatingRewards?.gold?.minRating || 0}
                                    onChange={e => handleDeepNestedChange('starRatingRewards', 'gold', 'minRating', normalizeNonNegativeNumber(e.target.value))}
                                    className="w-full border border-amber-200 p-1.5 rounded text-sm mt-1 bg-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-amber-700">Gold Bonus (%)</label>
                                <input 
                                    type="text" inputMode="decimal"
                                    value={policy.starRatingRewards?.gold?.bonusPercent || 0}
                                    onChange={e => handleDeepNestedChange('starRatingRewards', 'gold', 'bonusPercent', normalizeNonNegativeNumber(e.target.value))}
                                    className="w-full border border-amber-200 p-1.5 rounded text-sm mt-1 bg-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Vendor Welfare */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Heart className="h-5 w-5 text-rose-500" /> Vendor Welfare</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                            <span className="text-sm font-bold text-slate-700">Enable Suraksha Nidhi</span>
                            <input 
                                type="checkbox"
                                checked={policy.surakshaNidhi?.enabled}
                                onChange={e => handleNestedChange('surakshaNidhi', 'enabled', e.target.checked)}
                                className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                        </div>
                        {policy.surakshaNidhi?.enabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Min Deduction (₹)</label>
                                    <input 
                                        type="text" inputMode="numeric"
                                        value={policy.surakshaNidhi?.minDeduction || 0}
                                        onChange={e => handleNestedChange('surakshaNidhi', 'minDeduction', normalizeNonNegativeNumber(e.target.value))}
                                        className="w-full border p-2 rounded-lg mt-1 outline-emerald-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500">Max Deduction (₹)</label>
                                    <input 
                                        type="text" inputMode="numeric"
                                        value={policy.surakshaNidhi?.maxDeduction || 0}
                                        onChange={e => handleNestedChange('surakshaNidhi', 'maxDeduction', normalizeNonNegativeNumber(e.target.value))}
                                        className="w-full border p-2 rounded-lg mt-1 outline-emerald-500 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">No Work Protection (Months)</label>
                        <input 
                            type="text" inputMode="numeric"
                            value={policy.noWorkProtectionMonths || 0}
                            onChange={e => setPolicy({...policy, noWorkProtectionMonths: normalizeNonNegativeNumber(e.target.value)})}
                            className="w-full border p-2 rounded-lg mt-1 outline-emerald-500 text-sm"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">If no bookings received for this period, subscription is extended free of charge.</p>
                    </div>
                </div>
            </div>
            
          </div>
      )}
    </div>
  );
}
