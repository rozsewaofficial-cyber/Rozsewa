import React, { useState, useEffect } from 'react';
import { useScrollLock } from '@/lib/scrollLock';
import API from '@/lib/api';
import { Save, Loader2, Plus, Trash2, ShieldCheck, DollarSign, Gift, Calendar, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, XCircle, Edit } from 'lucide-react';
import { normalizeNonNegativeNumber, validateNonNegativeNumber } from '@/lib/numberValidation';

export default function PartnerProgramConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [config, setConfig] = useState({
    commissionSlabs: [],
    performanceBonuses: { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
    penalties: { cancellationCharge: 50 },
    referral: { commissionRate: 1, durationMonths: 12 },
    attendance: { requiredDays: 30, discountRate: 2 }
  });

  const [plans, setPlans] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  useScrollLock(showModal);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({
    name: "",
    price: "",
    planType: "monthly",
    category: "",
    offeredCommissionRate: "",
    description: "",
    features: [""],
    isActive: true
  });

  useEffect(() => {
    fetchCategories();
    fetchPlans();
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [selectedCategoryId]);

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
      const { data } = await API.get(`/admin/partner-program-config?categoryId=${selectedCategoryId}`);
      setConfig({
        commissionSlabs: data.commissionSlabs || [],
        performanceBonuses: data.performanceBonuses || { silverStarRate: 1, goldStarRate: 2, loyaltyBonusBookings: 100, loyaltyBonusAmount: 1000 },
        penalties: data.penalties || { cancellationCharge: 50 },
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
    const validations = [
      ...config.commissionSlabs.flatMap((slab, i) => [
        validateNonNegativeNumber(slab.min, { fieldName: `Slab ${i+1} Min` }),
        validateNonNegativeNumber(slab.max, { fieldName: `Slab ${i+1} Max` }),
        validateNonNegativeNumber(slab.rate, { fieldName: `Slab ${i+1} Rate` })
      ]),
      validateNonNegativeNumber(config.performanceBonuses.silverStarRate, { fieldName: "Silver Star Rate" }),
      validateNonNegativeNumber(config.performanceBonuses.goldStarRate, { fieldName: "Gold Star Rate" }),
      validateNonNegativeNumber(config.performanceBonuses.loyaltyBonusAmount, { fieldName: "Loyalty Bonus Amount" }),
      validateNonNegativeNumber(config.performanceBonuses.loyaltyBonusBookings, { fieldName: "Loyalty Target" }),
      validateNonNegativeNumber(config.referral.commissionRate, { fieldName: "Referral Commission" }),
      validateNonNegativeNumber(config.penalties.cancellationCharge, { fieldName: "Cancellation Charge" }),
      validateNonNegativeNumber(config.attendance.discountRate, { fieldName: "Attendance Discount" }),
      validateNonNegativeNumber(config.attendance.requiredDays, { fieldName: "Active Days Required" })
    ];

    const firstError = validations.find(v => !v.isValid);
    if (firstError) {
      toast({ title: "Invalid Input", description: firstError.error, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await API.put(`/admin/partner-program-config?categoryId=${selectedCategoryId}`, config);
      toast({ title: 'Configuration Saved Successfully!' });
    } catch (err) {
      toast({ title: 'Failed to save config', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateSlab = (index, field, value) => {
    const newSlabs = [...config.commissionSlabs];
    newSlabs[index][field] = field === 'categoryId' ? value : Number(normalizeNonNegativeNumber(value));
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
      planType: "monthly",
      category: selectedCategoryId || "",
      offeredCommissionRate: "",
      description: "",
      features: [""],
      isActive: true
    });
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setNewPlan({
      ...plan,
      category: plan.category?._id || plan.category
    });
    setShowModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!newPlan.name || !newPlan.price) {
      toast({ title: "Validation Error", description: "Name and Price are required", variant: "destructive" });
      return;
    }

    const priceValidation = validateNonNegativeNumber(newPlan.price, { fieldName: "Price", min: 0 });
    if (!priceValidation.isValid) {
      toast({ title: "Invalid Input", description: priceValidation.error, variant: "destructive" });
      return;
    }

    const commissionValidation = validateNonNegativeNumber(newPlan.offeredCommissionRate, { fieldName: "Commission Rate", min: 0 });
    if (!commissionValidation.isValid) {
      toast({ title: "Invalid Input", description: commissionValidation.error, variant: "destructive" });
      return;
    }

    const payload = { ...newPlan, category: newPlan.category || selectedCategoryId };

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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" /> Partner Program Configuration
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage commission rules, subscriptions, and incentives.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Commission Slabs */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><DollarSign className="h-5 w-5 text-blue-500" /> Commission Slabs</h2>
            <button onClick={addSlab} className="text-sm flex items-center gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
              <Plus className="h-4 w-4" /> Add Slab
            </button>
          </div>
          <div className="space-y-3">
            {config.commissionSlabs.map((slab, i) => (
              <div key={i} className="flex flex-col md:flex-row items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="w-full md:flex-[1.5]">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Category</label>
                  <select value={slab.categoryId || ''} onChange={e => updateSlab(i, 'categoryId', e.target.value)} className="w-full border py-2 pl-3 pr-8 rounded-lg text-sm outline-emerald-500 bg-white appearance-none relative">
                    <option value="">Global (Default)</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Min (₹)</label>
                  <input type="number" value={slab.min} onChange={e => updateSlab(i, 'min', e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-emerald-500" />
                </div>
                <div className="w-full md:flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Max (₹)</label>
                  <input type="number" value={slab.max} onChange={e => updateSlab(i, 'max', e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-emerald-500" />
                </div>
                <div className="w-full md:flex-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Rate (%)</label>
                  <input type="number" value={slab.rate} onChange={e => updateSlab(i, 'rate', e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-emerald-500" />
                </div>
                <button onClick={() => removeSlab(i)} className="mt-4 p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-purple-500" /> Subscription Plans</h2>
            <button onClick={() => { resetForm(); setEditingPlan(null); setShowModal(true); }} className="text-sm flex items-center gap-1 text-purple-600 hover:text-purple-700 bg-purple-50 px-2 py-1 rounded">
              <Plus className="h-4 w-4" /> Add Plan
            </button>
          </div>
          <div className="space-y-4">
            {plans.filter(p => (selectedCategoryId ? p.category?._id === selectedCategoryId || p.category === selectedCategoryId : true)).length === 0 ? (
              <p className="text-xs text-slate-400 font-bold p-4 text-center border-2 border-dashed rounded-lg">No plans found for this category.</p>
            ) : (
              plans.filter(p => (selectedCategoryId ? p.category?._id === selectedCategoryId || p.category === selectedCategoryId : true)).map((plan) => (
                <div key={plan._id} className="flex flex-col gap-2 bg-slate-50 p-4 rounded-lg border border-slate-100 relative group">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-slate-700">{plan.name}</span>
                      <span className="ml-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 uppercase tracking-widest">{plan.planType}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(plan)} className="text-slate-400 hover:text-blue-500"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => deletePlan(plan._id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Price (₹)</label>
                      <p className="text-sm font-black text-slate-800">₹{plan.price}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Commission Rate (%)</label>
                      <p className="text-sm font-black text-emerald-600">{plan.offeredCommissionRate}%</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Performance & Loyalty Bonuses */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Gift className="h-5 w-5 text-amber-500" /> Bonuses & Incentives</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Silver Star Bonus (%)</label>
              <input type="number" min="0" value={config.performanceBonuses.silverStarRate} onChange={e => setConfig({...config, performanceBonuses: {...config.performanceBonuses, silverStarRate: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-amber-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Gold Star Bonus (%)</label>
              <input type="number" min="0" value={config.performanceBonuses.goldStarRate} onChange={e => setConfig({...config, performanceBonuses: {...config.performanceBonuses, goldStarRate: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-amber-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Loyalty Bonus Amount (₹)</label>
              <input type="number" min="0" value={config.performanceBonuses.loyaltyBonusAmount} onChange={e => setConfig({...config, performanceBonuses: {...config.performanceBonuses, loyaltyBonusAmount: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-amber-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Loyalty Target (Bookings)</label>
              <input type="number" min="0" value={config.performanceBonuses.loyaltyBonusBookings} onChange={e => setConfig({...config, performanceBonuses: {...config.performanceBonuses, loyaltyBonusBookings: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-amber-500" />
            </div>
          </div>
        </div>

        {/* Referral, Attendance & Penalty */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-500" /> Other Rules</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500">Referral Commission (%)</label>
              <input type="number" min="0" value={config.referral.commissionRate} onChange={e => setConfig({...config, referral: {...config.referral, commissionRate: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-rose-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Cancellation Charge (₹)</label>
              <input type="number" min="0" value={config.penalties.cancellationCharge} onChange={e => setConfig({...config, penalties: {...config.penalties, cancellationCharge: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-rose-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Attendance Discount (%)</label>
              <input type="number" min="0" value={config.attendance.discountRate} onChange={e => setConfig({...config, attendance: {...config.attendance, discountRate: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">Active Days Required</label>
              <input type="number" min="0" value={config.attendance.requiredDays} onChange={e => setConfig({...config, attendance: {...config.attendance, requiredDays: Number(normalizeNonNegativeNumber(e.target.value))}})} className="w-full border p-2 rounded mt-1 outline-emerald-500" />
            </div>
          </div>
        </div>

      </div>
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
              className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-slate-100 shrink-0 flex justify-between items-center bg-white z-10">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>
                  <p className="text-sm font-bold text-slate-400">Configure subscription offerings for partners</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="flex flex-col min-h-0">
                {/* Scrollable Body */}
                <div className="p-6 md:p-8 overflow-y-auto space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Plan Name</label>
                      <input
                        type="text"
                        required
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="e.g. Elite Plan"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Category</label>
                      <select
                        required
                        value={newPlan.category}
                        onChange={(e) => setNewPlan({ ...newPlan, category: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none appearance-none"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Price (₹)</label>
                      <input
                        type="number"
                        required
                        value={newPlan.price}
                        onChange={(e) => setNewPlan({ ...newPlan, price: normalizeNonNegativeNumber(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="e.g. 999"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Billing Cycle</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl">
                        {['monthly', 'yearly'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewPlan({ ...newPlan, planType: t })}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newPlan.planType === t ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        required
                        value={newPlan.offeredCommissionRate}
                        onChange={(e) => setNewPlan({ ...newPlan, offeredCommissionRate: normalizeNonNegativeNumber(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        placeholder="e.g. 5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Visibility</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setNewPlan({ ...newPlan, isActive: true })}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newPlan.isActive ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPlan({ ...newPlan, isActive: false })}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!newPlan.isActive ? 'bg-slate-400 text-white' : 'text-slate-400'}`}
                        >
                          Hidden
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Plan Features (comma separated)</label>
                    <textarea
                      value={newPlan.features?.join(", ")}
                      onChange={(e) => setNewPlan({ ...newPlan, features: e.target.value.split(",").map(f => f.trim()) })}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 outline-none min-h-[100px]"
                      placeholder="e.g. Priority Support, 5% Commission, Verified Badge"
                    />
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="p-6 md:p-8 border-t border-slate-100 shrink-0 bg-slate-50 z-10">
                  <button
                    type="submit"
                    className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-[0.98]"
                  >
                    {editingPlan ? 'Save Changes' : 'Create Subscription Plan'}
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
