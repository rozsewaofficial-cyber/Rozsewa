import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Plus, Home, Briefcase, Navigation, Trash2, X, Map } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const Addresses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", address: "", icon: "home" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const { data } = await API.get("/auth/profile");
        setAddresses(data.addresses || []);
      } catch (err) {
        console.error("Failed to fetch addresses", err);
      } finally {
        setFetching(false);
      }
    };
    fetchAddresses();
  }, []);

  const handleAddAddress = async () => {
    if (!newAddr.label || !newAddr.address) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.post("/auth/addresses", newAddr);
      setAddresses(data); // Backend returns the updated addresses array
      toast({ title: "Address Added Successfully" });
      setShowAddForm(false);
      setNewAddr({ label: "", address: "", icon: "home" });
    } catch (err) {
      toast({ title: "Failed to add address", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/auth/addresses/${id}`);
      setAddresses(addresses.filter(addr => addr._id !== id));
      toast({ title: "Address Deleted" });
    } catch (err) {
      toast({ title: "Failed to delete address", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] pb-24 md:pb-0 font-sans selection:bg-blue-500/30">
      <TopNav />
      
      <main className="container max-w-2xl px-4 py-6 space-y-6 mx-auto">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={() => navigate('/profile')} 
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Saved Addresses</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Manage your delivery locations</p>
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }} 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="h-4 w-4" /> Add
          </motion.button>
        </div>

        <div className="space-y-4">
          {fetching ? (
             <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-[24px]"></div>
                ))}
             </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {addresses.map((addr) => (
                <motion.div 
                  key={addr._id} 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  className="relative overflow-hidden rounded-[24px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex gap-4 items-start">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${addr.icon === "office" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                      {addr.icon === "office" ? <Briefcase className="h-6 w-6" /> : <Home className="h-6 w-6" />}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-[16px] font-black text-slate-900 dark:text-white truncate">{addr.label}</h3>
                        <button 
                          onClick={() => handleDelete(addr._id)} 
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pr-6">{addr.address}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!fetching && addresses.length === 0 && !showAddForm && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
            >
              <div className="h-20 w-20 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-5">
                <Map className="h-10 w-10 text-blue-500 dark:text-blue-400" />
              </div>
              <h3 className="text-[18px] font-black text-slate-900 dark:text-white">No saved addresses</h3>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-2 max-w-[200px] leading-relaxed">Add your home or office address for quicker checkouts!</p>
              
              <button 
                onClick={() => setShowAddForm(true)}
                className="mt-6 font-bold text-blue-600 dark:text-blue-400 text-sm hover:underline"
              >
                Add an Address Now
              </button>
            </motion.div>
          )}

          {showAddForm && (
            <motion.div 
              initial={{ opacity: 0, y: 20, h: 0 }} 
              animate={{ opacity: 1, y: 0, h: "auto" }} 
              className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-xl shadow-slate-200/50 dark:shadow-none"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" /> Add New Address
                </h3>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-slate-300 px-1">Label Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Home, Office, Mom's Place..." 
                    value={newAddr.label} 
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                    className="w-full h-12 rounded-[16px] border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 text-[14px] font-bold text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-slate-300 px-1">Complete Address</label>
                  <textarea 
                    placeholder="Flat No, Building, Street, Area..." 
                    value={newAddr.address} 
                    onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
                    className="w-full rounded-[16px] border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-[14px] font-medium text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all outline-none resize-none" 
                    rows={3} 
                  />
                </div>
                
                <div className="space-y-2 pt-1">
                  <label className="text-[12px] font-bold text-slate-700 dark:text-slate-300 px-1">Save As</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'home', label: 'Home', icon: Home },
                      { id: 'office', label: 'Office', icon: Briefcase }
                    ].map(type => {
                      const Icon = type.icon;
                      const active = newAddr.icon === type.id;
                      return (
                        <button 
                          key={type.id} 
                          onClick={() => setNewAddr({ ...newAddr, icon: type.id })} 
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[16px] border-2 text-[13px] font-bold transition-all ${
                            active 
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${active ? 'fill-blue-600/20 dark:fill-blue-400/20' : ''}`} /> {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddAddress} 
                  disabled={loading} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-[16px] text-[14px] font-black uppercase tracking-wide shadow-lg shadow-blue-600/20 transition-all mt-2 disabled:opacity-70"
                >
                  {loading ? "Saving Address..." : "Save Address"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
};

export default Addresses;
