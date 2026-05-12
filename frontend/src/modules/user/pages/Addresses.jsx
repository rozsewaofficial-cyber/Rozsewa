import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Plus, Home, Briefcase, Navigation, Trash2, X } from "lucide-react";
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

  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const { data } = await API.get("/auth/profile");
        setAddresses(data.addresses || []);
      } catch (err) {
        console.error("Failed to fetch addresses", err);
      }
    };
    fetchAddresses();
  }, []);

  const handleAddAddress = async () => {
    if (!newAddr.label || !newAddr.address) return;
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
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <TopNav />
      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
            <h1 className="text-xl font-black text-foreground tracking-tight">Saved Addresses</h1>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Add New
          </motion.button>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {addresses.map((addr) => (
              <motion.div key={addr._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="relative overflow-hidden rounded-2xl border-2 border-border bg-card p-4 transition-all">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    {addr.icon === "office" ? <Briefcase className="h-6 w-6" /> : <Home className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-extrabold text-foreground">{addr.label}</h3>
                    <p className="mt-1 text-sm font-medium text-muted-foreground leading-relaxed truncate">{addr.address}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 border-t border-border/10 pt-3">
                  <button onClick={() => handleDelete(addr._id)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {addresses.length === 0 && !showAddForm && (
            <div className="rounded-2xl border-2 border-dashed border-border p-12 flex flex-col items-center justify-center text-center opacity-60">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-black text-foreground">No saved addresses</h3>
              <p className="text-xs font-bold text-muted-foreground mt-1">Add your home or office address to save time!</p>
            </div>
          )}

          {showAddForm && (
            <motion.div initial={{ opacity: 0, h: 0 }} animate={{ opacity: 1, h: "auto" }} className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 space-y-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider text-primary">New Address</h3><button onClick={() => setShowAddForm(false)}><X className="h-4 w-4" /></button></div>
              <div className="space-y-3">
                <input type="text" placeholder="Label (Home, Office...)" value={newAddr.label} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                    className="w-full h-12 rounded-xl border border-border bg-background px-4 text-sm font-bold focus:border-primary focus:outline-none" />
                <textarea placeholder="Complete Address" value={newAddr.address} onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium focus:border-primary focus:outline-none" rows={2} />
                <div className="flex gap-2">
                  {['home', 'office'].map(icon => (
                    <button key={icon} onClick={() => setNewAddr({ ...newAddr, icon })} className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold capitalize transition-all ${newAddr.icon === icon ? 'border-primary bg-primary text-white' : 'border-border bg-background'}`}>{icon}</button>
                  ))}
                </div>
                <button onClick={handleAddAddress} disabled={loading} className="w-full bg-primary text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                  {loading ? "Saving..." : "Save Address"}
                </button>
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
