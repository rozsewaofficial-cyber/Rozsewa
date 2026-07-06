import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useScrollLock } from '@/lib/scrollLock';
import API from '@/lib/api';
import { 
  Save, Loader2, Plus, Trash2, ShieldCheck, DollarSign, Gift, Calendar, 
  AlertTriangle, CreditCard, XCircle, Edit 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeNonNegativeNumber, validateNonNegativeNumber } from '@/lib/numberValidation';
import AdminPartnerPolicies from './AdminPartnerPolicies';

// Slab contiguity checker
const validateFrontendSlabs = (slabs) => {
  if (!slabs || slabs.length === 0) return { isValid: true };
  const sorted = [...slabs].sort((a, b) => Number(a.min) - Number(b.min));
  
  if (Number(sorted[0].min) !== 0) {
    return { isValid: false, error: "First slab min amount must start at 0." };
  }
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (Number(next.min) <= Number(current.max)) {
      return { isValid: false, error: `Overlap detected between slabs: ${current.min}-${current.max} and ${next.min}-${next.max}.` };
    }
    if (Number(next.min) > Number(current.max) + 1) {
      return { isValid: false, error: `Gap detected between slabs: ${current.min}-${current.max} and ${next.min}-${next.max}.` };
    }
  }
  
  const last = sorted[sorted.length - 1];
  if (Number(last.max) < 99999) {
    return { isValid: false, error: "Last slab max amount must cover all values (set to a large number like 999999)." };
  }
  return { isValid: true };
};

export default function PartnerProgramConfig() {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [activeTab, setActiveTab] = useState('rules'); // 'rules', 'slabs', 'subscriptions', 'bonuses'
  
  const [config, setConfig] = useState({
    freeTrialEnabled: true,
    freeServiceCount: 3,
    applyTo: 'all',
    selectedCategories: [],
    trialStarts: 'immediately_after_approval',
    trialEnds: 'exhausted',
    rulePriority: ['FREE_TRIAL', 'WAIVER', 'PROVIDER_OVERRIDE', 'SUBSCRIPTION', 'CATEGORY_SLAB', 'GLOBAL_DEFAULT'],
    ruleVersion: 1,
    commissionSlabs: [],
    performanceBonuses: { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
    penalties: { cancellationCharge: 100 },
    referral: { commissionRate: 1, durationMonths: 12 },
    attendance: { requiredDays: 30, discountRate: 2 }
  });

  const [plans, setPlans] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  const [newPlan, setNewPlan] = useState({
    name: "",
    price: "",
    duration: 365,
    planType: "yearly",
    category: "",
    commissionRate: "",
    description: "",
    status: "active",
    features: [""],
    featuredBadge: false,
    prioritySupport: false,
    searchBoost: false,
    unlimitedCategories: false,
    additionalLeads: false
  });

  const [editingPlan, setEditingPlan] = useState(null);
  useScrollLock(showModal);

  useEffect(() => {
    setTitle("Partner Program");
    fetchCategories();
    fetchPlans();
    fetchConfig();
  }, [setTitle]);

  const fetchCategories = async () => {
    try {
      const { data } = await API.get('/admin/categories');
      setCategories(data);
    } catch (err) {}
  };

  const fetchPlans = async () => {
    try {
      const { data } = await API.get("/admin/subscriptions");
      setPlans(data);
    } catch (err) {}
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/partner-program-config');
      setConfig({
        freeTrialEnabled: data.freeTrialEnabled !== undefined ? data.freeTrialEnabled : true,
        freeServiceCount: data.freeServiceCount || 3,
        applyTo: data.applyTo || 'all',
        selectedCategories: data.selectedCategories || [],
        trialStarts: data.trialStarts || 'immediately_after_approval',
        trialEnds: data.trialEnds || 'exhausted',
        rulePriority: data.rulePriority || ['FREE_TRIAL', 'WAIVER', 'PROVIDER_OVERRIDE', 'SUBSCRIPTION', 'CATEGORY_SLAB', 'GLOBAL_DEFAULT'],
        ruleVersion: data.ruleVersion || 1,
        commissionSlabs: data.commissionSlabs || [],
        performanceBonuses: data.performanceBonuses || { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
        penalties: data.penalties || { cancellationCharge: 100 },
        referral: data.referral || { commissionRate: 1, durationMonths: 12 },
        attendance: data.attendance || { requiredDays: 30, discountRate: 2 }
      });
    } catch (err) {
      toast({ title: 'Failed to load config', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate slabs contiguity
    const slabsByCategory = {};
    config.commissionSlabs.forEach(s => {
      const key = s.categoryId || 'global';
      if (!slabsByCategory[key]) slabsByCategory[key] = [];
      slabsByCategory[key].push({
        min: Number(s.min),
        max: Number(s.max),
        rate: Number(s.rate)
      });
    });

    for (const key of Object.keys(slabsByCategory)) {
      const validation = validateFrontendSlabs(slabsByCategory[key]);
      if (!validation.isValid) {
        const catName = key === 'global' ? 'Global Default' : `Category: ${categories.find(c => c._id === key)?.name || key}`;
        toast({ 
          title: "Validation Error", 
          description: `${catName}: ${validation.error}`, 
          variant: "destructive" 
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...config,
        freeServiceCount: Number(config.freeServiceCount) || 0,
        commissionSlabs: config.commissionSlabs.map(s => ({
          ...s,
          min: Number(s.min) || 0,
          max: Number(s.max) || 0,
          rate: Number(s.rate) || 0
        }))
      };
      await API.put('/admin/partner-program-config', payload);
      toast({ title: 'Configuration Saved Successfully!' });
      fetchConfig();
    } catch (err) {
      toast({ title: 'Failed to save config', description: err.response?.data?.message || 'Server error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateSlab = (index, field, value) => {
    const newSlabs = [...config.commissionSlabs];
    let val = field === 'categoryId' ? value : normalizeNonNegativeNumber(value);
    if (field === 'rate' && Number(val) > 100) {
      val = '100';
    }
    newSlabs[index][field] = val;
    setConfig({ ...config, commissionSlabs: newSlabs });
  };

  const addSlab = () => {
    setConfig({
      ...config,
      commissionSlabs: [...config.commissionSlabs, { categoryId: '', min: 0, max: 0, rate: 0 }]
    });
  };

  const removeSlab = (index) => {
    const newSlabs = config.commissionSlabs.filter((_, i) => i !== index);
    setConfig({ ...config, commissionSlabs: newSlabs });
  };



  const resetForm = () => {
    setNewPlan({
      name: "",
      price: "",
      duration: 365,
      planType: "yearly",
      category: "",
      commissionRate: "",
      description: "",
      status: "active",
      features: [""],
      featuredBadge: false,
      prioritySupport: false,
      searchBoost: false,
      unlimitedCategories: false,
      additionalLeads: false
    });
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    
    // Parse key-value benefits
    const benefitsMap = {};
    if (plan.benefits) {
      plan.benefits.forEach(b => {
        benefitsMap[b.key] = b.value;
      });
    }

    setNewPlan({
      name: plan.name,
      price: plan.price,
      duration: plan.duration || 365,
      planType: plan.planType || 'yearly',
      category: plan.category?._id || plan.category || "",
      commissionRate: plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate,
      description: plan.description || "",
      status: plan.status || "active",
      features: plan.features || [""],
      featuredBadge: !!benefitsMap['featured_badge'],
      prioritySupport: !!benefitsMap['priority_support'],
      searchBoost: !!benefitsMap['search_boost'],
      unlimitedCategories: !!benefitsMap['unlimited_categories'],
      additionalLeads: !!benefitsMap['additional_leads']
    });
    setShowModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!newPlan.name || !newPlan.price) {
      toast({ title: "Validation Error", description: "Name and Price are required", variant: "destructive" });
      return;
    }

    // Build key-value benefits array
    const benefitsList = [];
    if (newPlan.featuredBadge) benefitsList.push({ key: 'featured_badge', value: true });
    if (newPlan.prioritySupport) benefitsList.push({ key: 'priority_support', value: true });
    if (newPlan.searchBoost) benefitsList.push({ key: 'search_boost', value: true });
    if (newPlan.unlimitedCategories) benefitsList.push({ key: 'unlimited_categories', value: true });
    if (newPlan.additionalLeads) benefitsList.push({ key: 'additional_leads', value: true });

    const payload = {
      name: newPlan.name,
      price: Number(newPlan.price),
      duration: Number(newPlan.duration),
      planType: newPlan.planType,
      category: newPlan.category || null,
      commissionRate: Number(newPlan.commissionRate),
      offeredCommissionRate: Number(newPlan.commissionRate), // compatibility
      description: newPlan.description,
      status: newPlan.status,
      features: newPlan.features,
      benefits: benefitsList,
      isActive: newPlan.status === 'active'
    };

    try {
      if (editingPlan) {
        await API.put(`/admin/subscriptions/${editingPlan._id}`, payload);
        toast({ title: "Plan Updated Successfully" });
      } else {
        await API.post("/admin/subscriptions", payload);
        toast({ title: "Plan Created Successfully" });
      }
      fetchPlans();
      setShowModal(false);
      setEditingPlan(null);
      resetForm();
    } catch (err) {
      toast({ title: "Operation Failed", variant: "destructive" });
    }
  };

  const deletePlan = async (id) => {
    if (!window.confirm("Are you sure you want to delete this plan?")) return;
    try {
      await API.delete(`/admin/subscriptions/${id}`);
      setPlans(plans.filter(p => p._id !== id));
      toast({ title: "Plan Deleted" });
    } catch (err) {
      toast({ title: "Delete Failed", variant: "destructive" });
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" /> Partner Program & Config
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage onboarding, commission slabs, priorities, and subscription models.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        {[
          { id: 'rules', label: 'Onboarding & Rules' },
          { id: 'slabs', label: 'Commission Slabs' },
          { id: 'subscriptions', label: 'Subscription Plans' },
          { id: 'category_policies', label: 'Category Rules & Rewards' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-300 space-y-6">
          {/* Onboarding Settings */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-600" /> Provider Onboarding Rules
            </h2>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm font-bold text-slate-700">Enable Free Trial Benefits</p>
                  <p className="text-xs text-slate-400 font-medium">New providers start with 0% commission quota</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={config.freeTrialEnabled}
                  onChange={e => setConfig({ ...config, freeTrialEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                />
              </div>

              {config.freeTrialEnabled && (
                <div>
                  <label className="text-xs font-bold text-slate-500">Free Service Quota</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={config.freeServiceCount} 
                    onChange={e => setConfig({ ...config, freeServiceCount: normalizeNonNegativeNumber(e.target.value) })}
                    className="w-full border p-2.5 rounded-lg mt-1 outline-emerald-500 text-sm" 
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500">Apply To Categories</label>
                <select 
                  value={config.applyTo}
                  onChange={e => setConfig({ ...config, applyTo: e.target.value })}
                  className="w-full border p-2.5 rounded-lg mt-1 outline-emerald-500 text-sm bg-white"
                >
                  <option value="all">All Categories</option>
                  <option value="selected">Selected Categories Only</option>
                </select>
              </div>

              {config.applyTo === 'selected' && (
                <div className="p-3 border rounded-lg max-h-40 overflow-y-auto space-y-2">
                  {categories.map(cat => (
                    <label key={cat._id} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input 
                        type="checkbox"
                        checked={config.selectedCategories.includes(cat._id)}
                        onChange={e => {
                          const list = e.target.checked 
                            ? [...config.selectedCategories, cat._id]
                            : config.selectedCategories.filter(id => id !== cat._id);
                          setConfig({ ...config, selectedCategories: list });
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cancellation Charges */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Provider Cancellation Charges
            </h2>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-500">Cancellation Penalty (₹)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={config.penalties?.cancellationCharge !== undefined ? config.penalties.cancellationCharge : 100} 
                  onChange={e => {
                    const penaltyVal = normalizeNonNegativeNumber(e.target.value);
                    setConfig({ 
                      ...config, 
                      penalties: { 
                        ...config.penalties, 
                        cancellationCharge: Number(penaltyVal) 
                      } 
                    });
                  }}
                  className="w-full border p-2.5 rounded-lg mt-1 outline-emerald-500 text-sm font-semibold" 
                  placeholder="e.g. 100"
                />
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Amount deducted from the provider's wallet when they cancel a booking. 
                  50% of this charge will credit to the user, and 50% will credit to the admin.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'slabs' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><DollarSign className="h-5 w-5 text-blue-500" /> Commission Slabs</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Configure tiered commission cuts. Ensure slabs per category start at 0, are contiguous, and do not overlap.</p>
            </div>
            <button onClick={addSlab} className="text-sm flex items-center gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg font-bold">
              <Plus className="h-4 w-4" /> Add Slab
            </button>
          </div>
          
          <div className="space-y-3 pt-2">
            {config.commissionSlabs.map((slab, i) => (
              <div key={i} className="flex flex-col md:flex-row items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="w-full md:flex-[1.5]">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Category</label>
                  <select value={slab.categoryId || ''} onChange={e => updateSlab(i, 'categoryId', e.target.value)} className="w-full border p-2 rounded-lg text-sm bg-white outline-emerald-500">
                    <option value="">Global Default</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Min Amount (₹)</label>
                  <input type="text" inputMode="decimal" value={slab.min} onChange={e => updateSlab(i, 'min', e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-emerald-500" />
                </div>
                <div className="w-full md:flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Max Amount (₹)</label>
                  <input type="text" inputMode="decimal" value={slab.max} onChange={e => updateSlab(i, 'max', e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-emerald-500" />
                </div>
                <div className="w-full md:flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Rate (%)</label>
                  <input type="text" inputMode="decimal" value={slab.rate} onChange={e => updateSlab(i, 'rate', e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-emerald-500" />
                </div>
                <button onClick={() => removeSlab(i)} className="mt-4 p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CreditCard className="h-5 w-5 text-purple-500" /> Subscription Plans</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Configure annual/monthly plans for partners that override category commissions.</p>
            </div>
            <button onClick={() => { resetForm(); setEditingPlan(null); setShowModal(true); }} className="text-sm flex items-center gap-1 text-purple-600 hover:text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg font-bold">
              <Plus className="h-4 w-4" /> Add Plan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {plans.map((plan) => (
              <div key={plan._id} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-700 text-base">{plan.name}</span>
                    <span className="ml-2 text-[9px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 uppercase tracking-widest">{plan.duration} Days</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(plan)} className="text-slate-400 hover:text-blue-500 transition"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => deletePlan(plan._id)} className="text-slate-400 hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 font-medium leading-relaxed">{plan.description || "No description provided."}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-1 border-t border-slate-200/60 pt-3">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400">Price</label>
                    <p className="text-sm font-black text-slate-800">₹{plan.price}</p>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-400">Commission Rate</label>
                    <p className="text-sm font-black text-emerald-600">{plan.commissionRate !== undefined ? plan.commissionRate : plan.offeredCommissionRate}%</p>
                  </div>
                </div>

                {plan.benefits && plan.benefits.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {plan.benefits.map(b => (
                      <span key={b.key} className="text-[9px] font-bold px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-full">
                        {b.key.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans Modal */}
      {activeTab === 'category_policies' && (
        <div className="animate-in fade-in duration-300">
          <AdminPartnerPolicies />
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-white z-10">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h2>
                  <p className="text-xs font-semibold text-slate-400 mt-1">Configure subscription pricing and custom features</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-50 transition">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="flex flex-col min-h-0">
                <div className="p-6 md:p-8 overflow-y-auto space-y-5 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Plan Name</label>
                      <input
                        type="text"
                        required
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                        className="w-full border p-2.5 rounded-lg text-sm font-semibold outline-emerald-500"
                        placeholder="e.g. Elite Plan"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Target Category (Optional)</label>
                      <select
                        value={newPlan.category}
                        onChange={(e) => setNewPlan({ ...newPlan, category: e.target.value })}
                        className="w-full border p-2.5 rounded-lg text-sm bg-white outline-emerald-500"
                      >
                        <option value="">Global (All Categories)</option>
                        {categories.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Price (₹)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={newPlan.price}
                        onChange={(e) => setNewPlan({ ...newPlan, price: normalizeNonNegativeNumber(e.target.value) })}
                        className="w-full border p-2.5 rounded-lg text-sm outline-emerald-500"
                        placeholder="e.g. 799"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Duration (Days)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={newPlan.duration}
                        onChange={(e) => setNewPlan({ ...newPlan, duration: normalizeNonNegativeNumber(e.target.value) })}
                        className="w-full border p-2.5 rounded-lg text-sm outline-emerald-500"
                        placeholder="e.g. 365"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Commission Rate (%)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={newPlan.commissionRate}
                        onChange={(e) => {
                          const val = normalizeNonNegativeNumber(e.target.value);
                          setNewPlan({ ...newPlan, commissionRate: Number(val) > 100 ? '100' : val });
                        }}
                        className="w-full border p-2.5 rounded-lg text-sm outline-emerald-500"
                        placeholder="e.g. 10"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Status</label>
                      <select
                        value={newPlan.status}
                        onChange={(e) => setNewPlan({ ...newPlan, status: e.target.value })}
                        className="w-full border p-2.5 rounded-lg text-sm bg-white outline-emerald-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">Description</label>
                    <textarea
                      value={newPlan.description}
                      onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      className="w-full border p-2.5 rounded-lg text-sm outline-emerald-500 min-h-[60px]"
                      placeholder="Enter brief plan summary..."
                    />
                  </div>

                  {/* Dynamic Benefits Checklist */}
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-xs font-bold text-slate-700">Select Plan Benefits</label>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {[
                        { key: "featuredBadge", label: "Featured Provider Badge" },
                        { key: "prioritySupport", label: "Priority Support Line" },
                        { key: "searchBoost", label: "Higher Search Rankings" },
                        { key: "unlimitedCategories", label: "Unlimited Categories Leads" },
                        { key: "additionalLeads", label: "Additional Daily Leads" }
                      ].map(item => (
                        <label key={item.key} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={!!newPlan[item.key]}
                            onChange={e => setNewPlan({ ...newPlan, [item.key]: e.target.checked })}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 shrink-0 bg-slate-50 z-10 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm shadow hover:bg-emerald-700 transition"
                  >
                    {editingPlan ? 'Save Changes' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
