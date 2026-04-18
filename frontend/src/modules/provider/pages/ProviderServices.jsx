import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Edit3, Trash2, Eye, EyeOff, X, Save, IndianRupee, Loader2, Gift, Camera, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderServices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [combos, setCombos] = useState([]);
  const [categoryServices, setCategoryServices] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("services"); // "services" or "combos"
  const [showForm, setShowForm] = useState(false);
  const [showComboForm, setShowComboForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", basic: "", standard: "", premium: "", express: "", duration: "30 min", visible: true, image: "" });
  const [comboForm, setComboForm] = useState({ name: "", description: "", services: [], price: "", image: "" });
  const [uploading, setUploading] = useState(false);
  const [serviceSubTab, setServiceSubTab] = useState("active"); // "active" or "hidden"

  const { user } = useAuth();

  useEffect(() => {
    fetchProviderInfoAndServices();
  }, [user]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const { data } = await API.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setForm({ ...form, image: data.url });
      toast({ title: "Image Uploaded", description: "Service image updated successfully." });
    } catch (err) {
      toast({ title: "Upload Failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const fetchProviderInfoAndServices = async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/services");
      setServices(data.services || []);
      setCombos(data.combos || []);
      setCategoryServices(data.categoryServices || []);
      setCategoryName(data.categoryName || "Your Category");
    } catch (err) {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.basic) { toast({ title: "Name & Basic price required", variant: "destructive" }); return; }
    if (Number(form.basic) < 1) { toast({ title: "Price must be positive", variant: "destructive" }); return; }

    const payload = {
      name: form.name,
      description: form.description,
      duration: form.duration,
      visible: form.visible,
      image: form.image,
      category: categoryName, // Force match provider's category
      pricing: {
        basic: Number(form.basic),
        standard: form.standard ? Number(form.standard) : undefined,
        premium: form.premium ? Number(form.premium) : undefined,
        express: form.express ? Number(form.express) : 0
      }
    };

    try {
      if (editId) {
        await API.put(`/services/${editId}`, payload);
        toast({ title: "Service Updated" });
      } else {
        await API.post("/services", payload);
        toast({ title: "Service Added" });
      }
      fetchProviderInfoAndServices();
      resetForm();
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleComboSave = async (e) => {
    e.preventDefault();
    if (!comboForm.name || !comboForm.price || comboForm.services.length === 0) {
      toast({ title: "Missing fields", description: "Select services and enter price.", variant: "destructive" });
      return;
    }

    try {
      if (editId) {
        await API.put(`/services/combos/${editId}`, comboForm);
        toast({ title: "Combo Updated" });
      } else {
        await API.post("/services/combos", comboForm);
        toast({ title: "Combo Created" });
      }
      fetchProviderInfoAndServices();
      resetComboForm();
    } catch (err) {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const handleQuickAdd = async (s) => {
    const payload = {
      name: s.name,
      description: s.description || `Professional ${s.name} service`,
      duration: "1 hour",
      visible: true,
      category: categoryName,
      pricing: { basic: s.basePrice || 299, standard: (s.basePrice || 299) * 1.5, premium: (s.basePrice || 299) * 2, express: 99 }
    };
    try {
      await API.post("/services", payload);
      toast({ title: "Service Added", description: `${s.name} added to your shop.` });
      fetchProviderInfoAndServices();
    } catch (err) {
      toast({ title: "Failed to add", variant: "destructive" });
    }
  };

  const handleAddSuggested = (s) => {
    setForm({
      name: s.name,
      description: s.description || `Professional ${s.name} service`,
      basic: s.basePrice || 299,
      standard: (s.basePrice || 299) * 1.5,
      premium: (s.basePrice || 299) * 2,
      express: 99,
      duration: "1 hour",
      visible: true,
      image: ""
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => { setForm({ name: "", description: "", basic: "", standard: "", premium: "", express: "", duration: "30 min", visible: true, image: "" }); setShowForm(false); setEditId(null); };
  const resetComboForm = () => { setComboForm({ name: "", description: "", services: [], price: "", image: "" }); setShowComboForm(false); setEditId(null); };

  const handleEdit = (s) => {
    setForm({
      name: s.name,
      description: s.description,
      basic: s.pricing?.basic || "",
      standard: s.pricing?.standard || "",
      premium: s.pricing?.premium || "",
      express: s.pricing?.express || "",
      duration: s.duration || "30 min",
      visible: s.visible,
      image: s.image || ""
    });
    setEditId(s._id);
    setShowForm(true);
  };

  const handleEditCombo = (c) => {
    setComboForm({
      name: c.name,
      description: c.description,
      services: c.services.map(s => s._id),
      price: c.price,
      image: c.image || ""
    });
    setEditId(c._id);
    setShowComboForm(true);
  };

  const handleDeleteCombo = async (id) => {
    if (!confirm("Remove this combo?")) return;
    try {
      await API.delete(`/services/combos/${id}`);
      toast({ title: "Combo Removed" });
      fetchProviderInfoAndServices();
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    try {
      if (confirm("Are you sure you want to remove this service?")) {
        await API.delete(`/services/${id}`);
        toast({ title: "Service Removed" });
        fetchProviderInfoAndServices();
      }
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const toggleVisibility = async (s) => {
    try {
      await API.put(`/services/${s._id}`, { visible: !s.visible });
      fetchProviderInfoAndServices();
    } catch (err) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {!showForm && !showComboForm && <ProviderTopNav title="Service Hub" showBack={true} />}
      <main className="container max-w-3xl px-4 py-6 space-y-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-end">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { activeTab === "services" ? (resetForm(), setShowForm(true)) : (resetComboForm(), setShowComboForm(true)) }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> {activeTab === "services" ? "Add Service" : "Create Combo"}
            </motion.button>
          </div>

          <div className="flex p-1 bg-muted rounded-xl">
            {["services", "combos"].map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all ${activeTab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "services" ? "Individual Jobs" : "Discounted Combos"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Suggested Services Catalog */}
            {categoryServices.length > 0 && !showForm && !showComboForm && activeTab === "services" && (
              <section className="space-y-4 mb-8">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Gift className="h-4 w-4 text-emerald-500" /> Catalog for {categoryName}
                  </h2>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase">One-Tap Add</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1">
                  {categoryServices.map((suggestion, idx) => (
                    <motion.button
                      key={idx}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleAddSuggested(suggestion)}
                      className="flex min-w-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-50/50 p-5 text-center hover:border-emerald-500 hover:bg-emerald-50 transition-all group shrink-0"
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                        <Plus className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-black text-slate-800 line-clamp-1">{suggestion.name}</span>
                      <span className="text-[10px] font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
                        <IndianRupee className="h-2.5 w-2.5" /> {suggestion.basePrice || 299}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQuickAdd(suggestion); }}
                        className="mt-3 w-full rounded-lg bg-emerald-600 py-1.5 text-[9px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-all shadow-md shadow-emerald-500/20"
                      >
                        Quick Add
                      </button>
                      <span className="mt-1 text-[8px] font-bold text-emerald-500 group-hover:hidden">Tap to Customize</span>
                    </motion.button>
                  ))}
                </div>
              </section>
            )}

            <div className="flex items-center justify-between px-2">
              <div className="flex gap-4">
                {["active", "hidden"].map(st => (
                  <button
                    key={st}
                    onClick={() => setServiceSubTab(st)}
                    className={`text-[9px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${serviceSubTab === st ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                  >
                    {st === "active" ? "Public Shop" : "Combo Ingredients"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.filter(s => serviceSubTab === "active" ? s.visible : !s.visible).length === 0 && activeTab === "services" && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center">
                  <IndianRupee className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">{serviceSubTab === "active" ? "No public services yet" : "No hidden ingredients"}</p>
                </div>
              )}

              {activeTab === "services" && services.filter(s => serviceSubTab === "active" ? s.visible : !s.visible).map((s, i) => (
                <motion.div key={s._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`flex flex-col rounded-2xl border bg-card overflow-hidden transition-all ${s.visible ? "border-border" : "border-border/50 opacity-60"}`}>
                  {s.image && (
                    <div className="h-28 w-full relative">
                      <img src={s.image} alt={s.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                  )}
                  <div className="p-4 flex-1 text-left">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-foreground">
                        {s.name}
                        {!s.visible && <span className="ml-2 text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md uppercase align-middle">Combo Only</span>}
                      </h3>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => toggleVisibility(s)} className="p-1.5 rounded-lg hover:bg-muted">{s.visible ? <Eye className="h-3.5 w-3.5 text-emerald-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}</button>
                        <button onClick={() => handleEdit(s)} className="p-1.5 rounded-lg hover:bg-muted"><Edit3 className="h-3.5 w-3.5 text-blue-500" /></button>
                        <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded-lg hover:bg-muted"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>
                      </div>
                    </div>
                    {s.description && <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1 italic">{s.description}</p>}
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">Basic ₹{s.pricing?.basic}</span>
                      {s.pricing?.standard > 0 && <span className="rounded-lg bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-[9px] font-bold text-blue-700 dark:text-blue-300">Std ₹{s.pricing.standard}</span>}
                      {s.pricing?.premium > 0 && <span className="rounded-lg bg-purple-50 dark:bg-purple-900/30 px-2 py-1 text-[9px] font-bold text-purple-700 dark:text-purple-300">Prem ₹{s.pricing.premium}</span>}
                      {s.pricing?.express > 0 && (
                        <span className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700 animate-pulse border border-amber-200">
                          <Zap className="h-2.5 w-2.5 fill-amber-500" /> Express +₹{s.pricing.express}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground font-medium">Duration: {s.duration}</p>
                  </div>
                </motion.div>
              ))}

              {activeTab === "combos" && (
                <>
                  {combos.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center">
                      <Gift className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-semibold text-muted-foreground">No combo offers yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Bundle your services to create attractive deals for customers</p>
                    </div>
                  ) : combos.map((c, i) => (
                    <motion.div key={c._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex flex-col rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 overflow-hidden transition-all shadow-xl shadow-emerald-500/5">
                      {c.image && (
                        <div className="h-32 w-full relative">
                          <img src={c.image} alt={c.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-emerald-900/40 to-transparent" />
                          <div className="absolute top-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">Save Bundle</div>
                        </div>
                      )}
                      <div className="p-4 text-left space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight leading-tight">{c.name}</h3>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Combo Price: ₹{c.price}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handleEditCombo(c)} className="p-2 rounded-xl bg-white border border-slate-100 hover:border-blue-200 hover:text-blue-500 transition-all shadow-sm"><Edit3 className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteCombo(c._id)} className="p-2 rounded-xl bg-white border border-slate-100 hover:border-rose-200 hover:text-rose-500 transition-all shadow-sm"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.services.map(s => (
                            <span key={s._id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-100 text-[9px] font-bold text-slate-500 capitalize">
                              + {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-background text-left overflow-y-auto">
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.3 }}
                className="w-full min-h-screen bg-card sm:max-w-md sm:mx-auto sm:min-h-0 sm:my-8 sm:rounded-[32px] sm:border sm:border-border sm:shadow-2xl">
                <div className="flex items-center justify-between border-b border-border p-5 sticky top-0 bg-card z-10 text-foreground">
                  <h3 className="text-lg font-black uppercase tracking-tighter">{editId ? "Edit Service" : "Add Service"}</h3>
                  <button onClick={resetForm} className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-5">
                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Work Photo</label>
                    <div className="group relative h-48 w-full overflow-hidden rounded-[24px] bg-muted/50 border-2 border-dashed border-border hover:border-primary/50 transition-all">
                      {form.image ? (
                        <>
                          <img src={form.image} alt="Work" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => setForm({ ...form, image: "" })} className="h-10 w-10 rounded-full bg-white text-rose-500 shadow-xl flex items-center justify-center">
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2">
                          {uploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : (
                            <>
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                <Plus className="h-6 w-6" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload Sample Work</span>
                            </>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Service Name *</label>
                    <div className="relative">
                      <select
                        value={form.name}
                        onChange={e => {
                          const selected = categoryServices.find(s => s.name === e.target.value);
                          setForm({
                            ...form,
                            name: e.target.value,
                            basic: selected ? selected.basePrice : form.basic
                          });
                        }}
                        className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none appearance-none"
                      >
                        <option value="">Select a service...</option>
                        {categoryServices.map(s => (
                          <option key={s._id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Description</label>
                    <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none" placeholder="Describe the service..." />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pricing Tiers (₹)</label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-left">
                        <label className="block text-[8px] font-bold uppercase mb-1 text-muted-foreground">Basic</label>
                        <input type="number" min="1" value={form.basic} onChange={e => setForm({ ...form, basic: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background p-3 text-xs font-black focus:border-primary" placeholder="299" />
                      </div>
                      <div className="text-left">
                        <label className="block text-[8px] font-bold uppercase mb-1 text-muted-foreground">Standard</label>
                        <input type="number" value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background p-3 text-xs font-black focus:border-primary" placeholder="499" />
                      </div>
                      <div className="text-left">
                        <label className="block text-[8px] font-bold uppercase mb-1 text-muted-foreground">Premium</label>
                        <input type="number" value={form.premium} onChange={e => setForm({ ...form, premium: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background p-3 text-xs font-black focus:border-primary" placeholder="799" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-amber-500 fill-amber-500" /> Express Fee ₹
                      </label>
                      <input type="number" value={form.express} onChange={e => setForm({ ...form, express: e.target.value })}
                        className="w-full rounded-2xl border border-amber-500/30 bg-amber-50/10 p-4 text-xs font-black text-amber-700 focus:border-amber-500" placeholder="99" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Duration</label>
                      <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}
                        className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary appearance-none">
                        {["15 min", "30 min", "45 min", "1 hr", "1.5 hrs", "2 hrs", "3 hrs", "4+ hrs"].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-primary h-16 text-xs font-black uppercase tracking-[0.2em] text-primary-foreground shadow-2xl shadow-primary/30">
                    <Save className="h-4 w-4" /> {editId ? "Update" : "Add"} Service
                  </motion.button>
                </form>
              </motion.div>
            </motion.div>
          )}

          {showComboForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[999] bg-background text-left overflow-y-auto">
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.3 }}
                className="w-full min-h-screen bg-card sm:max-w-md sm:mx-auto sm:min-h-0 sm:my-8 sm:rounded-[32px] sm:border sm:border-border sm:shadow-2xl">
                <div className="flex items-center justify-between border-b border-border p-5 sticky top-0 bg-card z-10 text-foreground">
                  <h3 className="text-lg font-black uppercase tracking-tighter">{editId ? "Edit Combo" : "Create Combo"}</h3>
                  <button onClick={resetComboForm} className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleComboSave} className="p-6 space-y-5">
                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Banner Image</label>
                    <div className="group relative h-40 w-full overflow-hidden rounded-[24px] bg-emerald-50 border-2 border-dashed border-emerald-200">
                      {comboForm.image ? (
                        <>
                          <img src={comboForm.image} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => setComboForm({ ...comboForm, image: "" })} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white text-rose-500 shadow-md flex items-center justify-center"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 group-hover:bg-emerald-100/30 transition-all">
                          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-600" /> : <Camera className="h-6 w-6 text-emerald-400" />}
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Upload Banner</span>
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setUploading(true);
                            const fd = new FormData(); fd.append("image", file);
                            try {
                              const { data } = await API.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
                              setComboForm({ ...comboForm, image: data.url });
                            } catch { toast({ title: "Upload Failed" }); }
                            finally { setUploading(false); }
                          }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Bundle Name *</label>
                    <input required value={comboForm.name} onChange={e => setComboForm({ ...comboForm, name: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-emerald-500" placeholder="e.g. Full Home Cleaning Pack" />
                  </div>

                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Included Services * (Select Multiple)</label>
                    <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[100px]">
                      {categoryServices.map((catSvc, i) => {
                        const existingSvc = services.find(s => s.name === catSvc.name);
                        const isSelected = existingSvc && comboForm.services.includes(existingSvc._id);
                        const isAdded = !!existingSvc;

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={async () => {
                              let targetSvc = existingSvc;
                              if (!isAdded) {
                                // Direct Quick Add logic here for speed
                                const payload = {
                                  name: catSvc.name,
                                  description: catSvc.description || `Professional ${catSvc.name} service`,
                                  duration: "1 hour",
                                  visible: false, // Hidden by default if added via Combo
                                  category: categoryName,
                                  pricing: { basic: catSvc.basePrice || 299, standard: (catSvc.basePrice || 299) * 1.5, premium: (catSvc.basePrice || 299) * 2, express: 99 }
                                };
                                try {
                                  const { data } = await API.post("/services", payload);
                                  targetSvc = data;
                                  // Update services list locally to reflect the new addition
                                  setServices(prev => [...prev, data]);
                                } catch (err) {
                                  toast({ title: "Quick Add Failed", variant: "destructive" });
                                  return;
                                }
                              }

                              const selected = comboForm.services.includes(targetSvc._id);
                              setComboForm({
                                ...comboForm,
                                services: selected ? comboForm.services.filter(id => id !== targetSvc._id) : [...comboForm.services, targetSvc._id]
                              });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 ${isSelected
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/20"
                              : isAdded
                                ? "bg-white text-emerald-600 border-emerald-100"
                                : "bg-white text-slate-400 border-dashed border-slate-300 italic"
                              }`}
                          >
                            {!isAdded && <Plus className="h-2.5 w-2.5" />}
                            {catSvc.name}
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse ml-1" />}
                          </button>
                        );
                      })}
                      {categoryServices.length === 0 && (
                        <p className="text-[10px] font-bold text-slate-400 text-center w-full py-4">Loading catalog...</p>
                      )}
                    </div>
                  </div>

                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Combo Display Price ₹ *</label>
                    <input type="number" required value={comboForm.price} onChange={e => setComboForm({ ...comboForm, price: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-black focus:border-emerald-500" placeholder="Bundle Price" />
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-emerald-600 h-16 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-emerald-500/30">
                    <Save className="h-4 w-4" /> {editId ? "Update" : "Launch"} Combo Offer
                  </motion.button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderServices;
