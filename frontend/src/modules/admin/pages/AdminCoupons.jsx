import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Tag, Plus, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

const initialCoupons = [
  { id: "C-1", code: "Rozsewa30", discount: "30%", maxUses: 100, used: 45, expiry: "2026-12-31", status: "active" },
  { id: "C-2", code: "WELCOME50", discount: "₹50", maxUses: 500, used: 312, expiry: "2026-06-30", status: "active" },
  { id: "C-3", code: "FESTIVE20", discount: "20%", maxUses: 50, used: 50, expiry: "2025-11-20", status: "expired" },
];

const AdminCoupons = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState(() => {
    const saved = localStorage.getItem("rozsewa_admin_coupons");
    return saved ? JSON.parse(saved) : initialCoupons;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: "", discount: "", maxUses: "", expiry: "" });

  useEffect(() => {
    setTitle("Promo Codes & Coupons");
  }, [setTitle]);

  useEffect(() => {
    localStorage.setItem("rozsewa_admin_coupons", JSON.stringify(coupons));
  }, [coupons]);

  const handleToggleStatus = (id) => {
    setCoupons(coupons.map(c => {
      if (c.id === id) {
        return { ...c, status: c.status === "active" ? "disabled" : "active" };
      }
      return c;
    }));
  };

  const handleDelete = (id) => {
    setCoupons(coupons.filter(c => c.id !== id));
    toast({ title: "Coupon Deleted", description: "The coupon has been permanently removed." });
  };

  const handleCreateCoupon = (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discount || !newCoupon.maxUses || !newCoupon.expiry) {
      toast({ title: "Required Fields", description: "Please fill all fields.", variant: "destructive" });
      return;
    }
    const coupon = {
      id: `C-${Date.now()}`,
      code: newCoupon.code.toUpperCase(),
      discount: newCoupon.discount,
      maxUses: Number(newCoupon.maxUses),
      used: 0,
      expiry: newCoupon.expiry,
      status: "active"
    };
    setCoupons([coupon, ...coupons]);
    setNewCoupon({ code: "", discount: "", maxUses: "", expiry: "" });
    setShowModal(false);
    toast({ title: "Coupon Created", description: `Coupon ${coupon.code} is now live.` });
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
        {filteredCoupons.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-medium">No coupons found.</div>
        ) : (
          filteredCoupons.map((coupon) => (
            <motion.div key={coupon.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all ${coupon.status === 'expired' ? 'border-gray-200 opacity-60' : coupon.status === 'disabled' ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 hover:shadow-md'}`}>
              {/* Decorative cutouts */}
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-gray-200 bg-gray-50"></div>
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-gray-200 bg-gray-50"></div>
              <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 border-t-2 border-dashed border-gray-200"></div>

              <div className="relative z-10 flex flex-col h-full gap-5 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${coupon.status === 'active' ? 'emerald' : 'gray'}-100`}>
                      <Tag className={`h-5 w-5 text-${coupon.status === 'active' ? 'emerald' : 'gray'}-600`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-gray-900 font-mono">{coupon.code}</h3>
                      <p className="text-xs font-bold text-emerald-600">{coupon.discount} OFF</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${coupon.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    coupon.status === 'disabled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {coupon.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Usage</p>
                    <p className="font-semibold text-gray-800 text-sm mt-0.5">{coupon.used} / {coupon.maxUses}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Expiry Date</p>
                    <p className="font-semibold text-gray-800 text-sm mt-0.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-gray-500" /> {coupon.expiry}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between pt-4 border-t border-gray-100/50">
                  <button
                    onClick={() => handleToggleStatus(coupon.id)}
                    disabled={coupon.status === "expired"}
                    className={`text-xs font-bold flex items-center gap-1.5 transition-colors ${coupon.status === "expired" ? "text-gray-400 cursor-not-allowed" :
                      coupon.status === "active" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"
                      }`}
                  >
                    {coupon.status === "active" ? <><XCircle className="h-4 w-4" /> Disable</> : <><CheckCircle2 className="h-4 w-4" /> Enable</>}
                  </button>

                  <button onClick={() => handleDelete(coupon.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-gray-100">
              <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-emerald-900 flex items-center gap-2"><Plus className="h-5 w-5" /> New Promo Code</h3>
                <button onClick={() => setShowModal(false)} className="rounded-full p-2 bg-white/50 text-emerald-700 hover:bg-white transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Coupon Code</label>
                  <input type="text" placeholder="e.g. SUMMER50" value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-mono font-bold uppercase placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Discount Amount</label>
                    <input type="text" placeholder="e.g. 20% or ₹100" value={newCoupon.discount} onChange={e => setNewCoupon({ ...newCoupon, discount: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Max Uses</label>
                    <input type="number" placeholder="Limit" value={newCoupon.maxUses} onChange={e => setNewCoupon({ ...newCoupon, maxUses: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Expiry Date</label>
                  <input type="date" value={newCoupon.expiry} onChange={e => setNewCoupon({ ...newCoupon, expiry: e.target.value })} className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
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
