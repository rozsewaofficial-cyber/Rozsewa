import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Loader2, CreditCard, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const AdminSubscriptions = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [plans, setPlans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
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
    setTitle("Subscription Management");
    fetchPlans();
    fetchCategories();
  }, [setTitle]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/admin/subscriptions");
      setPlans(data);
    } catch (err) {
      toast({ title: "Fetch Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await API.get("/admin/categories");
      setCategories(data);
    } catch (err) {}
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!newPlan.name || !newPlan.category || !newPlan.price) {
      toast({ title: "Validation Error", description: "Name, Category and Price are required", variant: "destructive" });
      return;
    }

    try {
      if (editingPlan) {
        const { data } = await API.put(`/admin/subscriptions/${editingPlan._id}`, newPlan);
        toast({ title: "Plan Updated Successfully" });
      } else {
        const { data } = await API.post("/admin/subscriptions", newPlan);
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

  const resetForm = () => {
    setNewPlan({
      name: "",
      price: "",
      planType: "monthly",
      category: "",
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

  const filteredPlans = plans.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2.5rem] border border-blue-50 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search plans or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          />
        </div>
        <button
          onClick={() => { resetForm(); setEditingPlan(null); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Plans...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="col-span-full bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-100">
            <CreditCard className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-black text-slate-900">No Plans Found</h3>
            <p className="text-sm font-bold text-slate-400 mt-1">Start by creating your first subscription plan</p>
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <motion.div
              layout
              key={plan._id}
              className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${plan.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 leading-tight">{plan.name}</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">{plan.category?.name || 'Uncategorized'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(plan)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => deletePlan(plan._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Plan Pricing</p>
                    <p className="text-2xl font-black text-slate-900">₹{plan.price}<span className="text-xs opacity-40">/{plan.planType === 'monthly' ? 'mo' : 'yr'}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Commission</p>
                    <p className="text-lg font-black text-emerald-600">{plan.offeredCommissionRate}%</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Plan Features</p>
                  <div className="space-y-2">
                    {plan.features?.slice(0, 3).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {f}
                      </div>
                    ))}
                    {plan.features?.length > 3 && (
                      <p className="text-[10px] font-bold text-slate-400 ml-5">+{plan.features.length - 3} more features</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
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
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>
                    <p className="text-sm font-bold text-slate-400">Configure subscription offerings for partners</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSavePlan} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Plan Name</label>
                      <input
                        type="text"
                        required
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                        placeholder="e.g. Electrician Pro"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Category</label>
                      <select
                        required
                        value={newPlan.category}
                        onChange={(e) => setNewPlan({ ...newPlan, category: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none"
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
                        onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newPlan.planType === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                        onChange={(e) => setNewPlan({ ...newPlan, offeredCommissionRate: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none min-h-[100px]"
                      placeholder="e.g. Priority Support, 5% Commission, Verified Badge"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    {editingPlan ? 'Save Changes' : 'Create Subscription Plan'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminSubscriptions;
