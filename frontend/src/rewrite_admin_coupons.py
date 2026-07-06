import os

file_path = r"d:\Rojsewa-main\frontend\src\modules\admin\pages\AdminCoupons.jsx"

content = """import { useState, useEffect } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useOutletContext } from "react-router-dom";
import { Search, Tag, Plus, CheckCircle2, XCircle, Clock, Trash2, Tag as TagIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { normalizeNonNegativeNumber, validateNonNegativeNumber } from "@/lib/numberValidation";
import { validateDate } from "@/lib/dateValidation";
import axios from 'axios';
import { useSelector } from 'react-redux';

const AdminCoupons = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  
  const { adminInfo } = useSelector((state) => state.adminAuth);
  
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ 
      code: "", 
      discount: "", 
      maxUses: "", 
      expiry: "", 
      minOrderAmount: "",
      maxDiscountAmount: "",
      targetCategory: "" 
  });
  const [loading, setLoading] = useState(true);

  useScrollLock(showModal);

  useEffect(() => {
    setTitle("Promo Codes & Coupons");
    fetchCoupons();
    fetchCategories();
  }, [setTitle]);

  const config = {
      headers: {
          Authorization: `Bearer ${adminInfo?.token}`
      }
  };

  const fetchCoupons = async () => {
      try {
          const { data } = await axios.get('http://localhost:5000/api/admin/coupons', config);
          setCoupons(data);
      } catch (error) {
          toast({ title: "Error", description: "Failed to fetch coupons", variant: "destructive" });
      } finally {
          setLoading(false);
      }
  };

  const fetchCategories = async () => {
      try {
          const { data } = await axios.get('http://localhost:5000/api/public/categories');
          setCategories(data);
      } catch (error) {
          console.error("Failed to fetch categories:", error);
      }
  };

  const handleToggleStatus = async (id) => {
      try {
          const { data } = await axios.put(`http://localhost:5000/api/admin/coupons/${id}/toggle`, {}, config);
          setCoupons(coupons.map(c => c._id === id ? data : c));
          toast({ title: "Status Updated", description: `Coupon is now ${data.isActive ? 'active' : 'disabled'}` });
      } catch (error) {
          toast({ title: "Error", description: error.response?.data?.message || "Failed to update status", variant: "destructive" });
      }
  };

  const handleDelete = async (id) => {
      if (window.confirm("Are you sure you want to delete this coupon?")) {
          try {
              await axios.delete(`http://localhost:5000/api/admin/coupons/${id}`, config);
              setCoupons(coupons.filter(c => c._id !== id));
              toast({ title: "Coupon Deleted", description: "The coupon has been permanently removed." });
          } catch (error) {
              toast({ title: "Error", description: "Failed to delete coupon", variant: "destructive" });
          }
      }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discount || !newCoupon.maxUses || !newCoupon.expiry) {
      toast({ title: "Required Fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }

    const maxUsesValidation = validateNonNegativeNumber(newCoupon.maxUses, { fieldName: "Max Uses", min: 1 });
    if (!maxUsesValidation.isValid) {
      toast({ title: "Invalid Input", description: maxUsesValidation.error, variant: "destructive" });
      return;
    }

    const expiryValidation = validateDate(newCoupon.expiry, {
      minDate: new Date(),
      minErrorMessage: "Expiry date cannot be in the past."
    });
    if (!expiryValidation.isValid) {
      toast({ title: "Invalid Date", description: expiryValidation.message, variant: "destructive" });
      return;
    }

    try {
        const payload = {
            code: newCoupon.code,
            discount: newCoupon.discount,
            maxUsage: Number(newCoupon.maxUses),
            expiryDate: newCoupon.expiry,
            minOrderAmount: newCoupon.minOrderAmount ? Number(newCoupon.minOrderAmount) : 0,
            maxDiscountAmount: newCoupon.maxDiscountAmount ? Number(newCoupon.maxDiscountAmount) : null,
            targetCategory: newCoupon.targetCategory || null
        };

        const { data } = await axios.post('http://localhost:5000/api/admin/coupons', payload, config);
        setCoupons([data, ...coupons]);
        setNewCoupon({ code: "", discount: "", maxUses: "", expiry: "", minOrderAmount: "", maxDiscountAmount: "", targetCategory: "" });
        setShowModal(false);
        toast({ title: "Coupon Created", description: `Coupon ${data.code} is now live.` });
    } catch (error) {
        toast({ title: "Error", description: error.response?.data?.message || "Failed to create coupon", variant: "destructive" });
    }
  };

  const filteredCoupons = coupons.filter(c => {
    const code = c?.code || "";
    const search = (searchTerm || "").toLowerCase();
    return code.toLowerCase().includes(search);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Promo Codes</h2>
          <p className="mt-1 text-sm text-gray-500">Create discounts and promotional offers for users.</p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:min-w-[250px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
              placeholder="Search promo code..."
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">Loading coupons...</div>
        ) : filteredCoupons.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">No coupons found.</div>
        ) : (
          filteredCoupons.map((coupon) => {
            const isExpired = new Date(coupon.expiryDate) < new Date();
            const statusLabel = isExpired ? 'expired' : (coupon.isActive ? 'active' : 'disabled');

            return (
            <motion.div key={coupon._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all ${statusLabel === 'expired' ? 'border-gray-200 opacity-60' : statusLabel === 'disabled' ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 hover:shadow-md'}`}>
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-gray-200 bg-gray-50"></div>
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-gray-200 bg-gray-50"></div>
              <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 border-t-2 border-dashed border-gray-200"></div>

              <div className="relative z-10 flex flex-col h-full gap-5 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${statusLabel === 'active' ? 'emerald' : 'gray'}-100`}>
                      <Tag className={`h-5 w-5 text-${statusLabel === 'active' ? 'emerald' : 'gray'}-600`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-gray-900 font-mono">{coupon.code}</h3>
                      <p className="text-xs font-bold text-emerald-600">{coupon.discount} OFF</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusLabel === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    statusLabel === 'disabled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {statusLabel}
                  </span>
                </div>
                
                {coupon.targetCategory && (
                    <div className="mt-1 flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold w-max">
                        <TagIcon className="h-3.5 w-3.5" />
                        {coupon.targetCategory.name} Only
                    </div>
                )}
                {!coupon.targetCategory && (
                    <div className="mt-1 flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold w-max">
                        <TagIcon className="h-3.5 w-3.5" />
                        Global (All Categories)
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Usage</p>
                    <p className="font-semibold text-gray-800 text-sm mt-0.5">{coupon.usageCount || 0} / {coupon.maxUsage}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Expiry Date</p>
                    <p className="font-semibold text-gray-800 text-sm mt-0.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-gray-500" /> {new Date(coupon.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between pt-4 border-t border-gray-100/50">
                  <button
                    onClick={() => handleToggleStatus(coupon._id)}
                    disabled={isExpired}
                    className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${isExpired ? "text-gray-400 cursor-not-allowed" :
                      coupon.isActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"
                      }`}
                  >
                    {coupon.isActive ? <><XCircle className="h-4 w-4" /> Disable</> : <><CheckCircle2 className="h-4 w-4" /> Enable</>}
                  </button>

                  <button onClick={() => handleDelete(coupon._id)} className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )})
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-gray-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-lg font-extrabold text-emerald-900 flex items-center gap-2"><Plus className="h-5 w-5" /> New Promo Code</h3>
                <button type="button" onClick={() => setShowModal(false)} className="rounded-full p-2 bg-white/50 text-emerald-700 hover:bg-white transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Coupon Code</label>
                  <input required type="text" placeholder="e.g. SUMMER50" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-mono font-bold uppercase placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Target Category</label>
                  <select 
                      value={newCoupon.targetCategory} 
                      onChange={e => setNewCoupon({ ...newCoupon, targetCategory: e.target.value })} 
                      className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold text-gray-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                      <option value="">Global / All Categories</option>
                      {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.name}</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Discount Amount</label>
                    <input required type="text" placeholder="e.g. 20% or ₹100" value={newCoupon.discount} onChange={e => setNewCoupon({ ...newCoupon, discount: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Max Uses</label>
                    <input required type="number" min="1" placeholder="Limit" value={newCoupon.maxUses} onChange={e => setNewCoupon({ ...newCoupon, maxUses: normalizeNonNegativeNumber(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Min Order Amount (₹)</label>
                    <input type="number" min="0" placeholder="e.g. 500" value={newCoupon.minOrderAmount} onChange={e => setNewCoupon({ ...newCoupon, minOrderAmount: normalizeNonNegativeNumber(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Max Discount (₹)</label>
                    <input type="number" min="0" placeholder="Optional" value={newCoupon.maxDiscountAmount} onChange={e => setNewCoupon({ ...newCoupon, maxDiscountAmount: normalizeNonNegativeNumber(e.target.value) })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Expiry Date</label>
                  <input required type="date" min={new Date().toISOString().split('T')[0]} value={newCoupon.expiry} onChange={e => setNewCoupon({ ...newCoupon, expiry: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-colors active:scale-95 transition-all">Publish Coupon</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCoupons;
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Rewrote AdminCoupons.jsx")
