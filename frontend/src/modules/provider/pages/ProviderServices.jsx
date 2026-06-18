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
  const [form, setForm] = useState({ name: "", customName: "", description: "", basic: "", standard: "", premium: "", express: "", duration: "30 min", visible: true, image: "" });
  const [viewService, setViewService] = useState(null);
  const [comboForm, setComboForm] = useState({ name: "", description: "", services: [], price: "", image: "" });
  const [uploading, setUploading] = useState(false);
  const [serviceSubTab, setServiceSubTab] = useState("active"); // "active" or "hidden"
  const [saving, setSaving] = useState(false);
  const [newCustomService, setNewCustomService] = useState("");

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

  const fetchProviderInfoAndServices = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await API.get("/services");
      setServices(data.services || []);
      setCombos(data.combos || []);
      setCategoryServices(data.categoryServices || []);
      setCategoryName(data.categoryName || "Your Category");
    } catch (err) {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    const finalName = form.name === "custom" ? form.customName : form.name;
    if (!finalName || !form.price) { toast({ title: "Name & Price required", variant: "destructive" }); return; }
    if (Number(form.price) < 1) { toast({ title: "Price must be positive", variant: "destructive" }); return; }

    setSaving(true);

    const payload = {
      name: finalName,
      description: form.description,
      duration: form.duration,
      visible: form.visible,
      image: form.image,
      category: categoryName, // Force match provider's category
      price: Number(form.price) || 0,
    };

    try {
      if (editId) {
        await API.put(`/services/${editId}`, payload);
        toast({ title: "Service Updated" });
        fetchProviderInfoAndServices(false);
      } else {
        await API.post("/services", payload);
        toast({ title: "Service Added" });
        fetchProviderInfoAndServices(false);
        resetForm();
      }
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleComboSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!comboForm.name || !comboForm.price || comboForm.services.length === 0) {
      toast({ title: "Missing fields", description: "Select services and enter price.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      if (editId) {
        await API.put(`/services/combos/${editId}`, comboForm);
        toast({ title: "Combo Updated" });
        fetchProviderInfoAndServices(false);
      } else {
        await API.post("/services/combos", comboForm);
        toast({ title: "Combo Created" });
        fetchProviderInfoAndServices(false);
        resetComboForm();
      }
    } catch (err) {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdd = async (s) => {
    if (saving) return;
    setSaving(true);
    const isSewak = user?.providerCategory === 'sewak';
    const payload = {
      name: s.name,
      description: s.description || `Professional ${s.name} service`,
      duration: "1 hour",
      visible: true,
      category: categoryName,
      price: isSewak ? (s.basePrice || 299) : (s.basePrice || 299)
    };
    try {
      await API.post("/services", payload);
      toast({ title: "Service Added", description: `${s.name} added to your shop.` });
      fetchProviderInfoAndServices(false);
    } catch (err) {
      toast({ title: "Failed to add", variant: "destructive" });
    }
  };

  const handleAddSuggested = (s) => {
    const isSewak = user?.providerCategory === 'sewak';
    setForm({
      name: s.name,
      description: s.description || `Professional ${s.name} service`,
      price: isSewak ? (s.basePrice || 299) : "",
      duration: "1 hour",
      visible: true,
      image: ""
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => { setForm({ name: "", customName: "", description: "", price: "", duration: "30 min", visible: true, image: "" }); setShowForm(false); setEditId(null); };
  const resetComboForm = () => { setComboForm({ name: "", description: "", services: [], price: "", image: "" }); setShowComboForm(false); setEditId(null); };

  const handleEdit = (s) => {
    const isCustom = !categoryServices.some(cat => cat.name === s.name);
    setForm({
      name: isCustom ? "custom" : s.name,
      customName: isCustom ? s.name : "",
      description: s.description,
      price: s.price || "",
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
      fetchProviderInfoAndServices(false);
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      if (confirm("Are you sure you want to remove this service?")) {
        await API.delete(`/services/${id}`);
        toast({ title: "Service Removed" });
        fetchProviderInfoAndServices(false);
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

          {user?.providerCategory !== 'sewak' && (
            <div className="flex items-center justify-end">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { activeTab === "services" ? (resetForm(), setShowForm(true)) : (resetComboForm(), setShowComboForm(true)) }}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" /> {activeTab === "services" ? "Add Service" : "Create Combo"}
              </motion.button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Suggested Services Catalog */}
            {categoryServices.length > 0 && !showForm && !showComboForm && activeTab === "services" && user?.providerCategory !== 'sewak' && (
              <section className="space-y-4 mb-8">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Gift className="h-4 w-4 text-emerald-500" /> Catalog for {categoryName}
                  </h2>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 uppercase">One-Tap Add</span>
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
                      className="flex min-w-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-50/50 p-5 text-center hover:border-emerald-500 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 dark:border-emerald-800 dark:hover:border-emerald-700 transition-all group shrink-0"
                    >
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-emerald-900 text-emerald-600 shadow-sm group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                        <Plus className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 line-clamp-1">{suggestion.name}</span>
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

            {activeTab === "services" && (
              <div className="flex items-center justify-end gap-4 px-2 -mt-2 mb-2">
                <button 
                  onClick={() => setServiceSubTab("active")} 
                  className={`text-[10px] font-black uppercase tracking-widest transition-colors ${serviceSubTab === "active" ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Active
                </button>
                <button 
                  onClick={() => setServiceSubTab("hidden")} 
                  className={`text-[10px] font-black uppercase tracking-widest transition-colors ${serviceSubTab === "hidden" ? "text-slate-600 dark:text-slate-300" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Combo-Only
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {services.filter(s => serviceSubTab === "active" ? s.visible : !s.visible).length === 0 && activeTab === "services" && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center">
                  <IndianRupee className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">{serviceSubTab === "active" ? "No active services yet" : "No combo-only services"}</p>
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
                      <h3 className="text-sm font-black text-foreground">
                        {s.name}
                        {!s.visible && <span className="ml-2 text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md uppercase align-middle">Combo Only</span>}
                      </h3>
                      {user?.providerCategory !== 'sewak' && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setViewService(s)} className="p-1.5 rounded-lg hover:bg-muted"><Eye className="h-3.5 w-3.5 text-slate-500" /></button>
                          <button onClick={() => handleEdit(s)} className="p-1.5 rounded-lg hover:bg-muted"><Edit3 className="h-3.5 w-3.5 text-blue-500" /></button>
                          <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded-lg hover:bg-muted"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></button>
                        </div>
                      )}
                    </div>
                    {s.description && <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1 italic">{s.description}</p>}
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">Price ₹{s.price}</span>
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
                      className="flex flex-col rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 overflow-hidden transition-all shadow-xl shadow-emerald-500/5">
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
                            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">{c.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Combo Price: ₹{c.price}</p>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${c.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                c.status === 'rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' :
                                  'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                }`}>
                                {c.status || 'Pending'}
                              </span>
                            </div>
                          </div>
                          {user?.providerCategory !== 'sewak' && (
                            <div className="flex gap-2 relative z-10">
                              <button onClick={() => handleEditCombo(c)} className="p-2 rounded-xl bg-card border border-border hover:border-blue-200 hover:text-blue-500 transition-all shadow-sm"><Edit3 className="h-4 w-4" /></button>
                              <button onClick={() => handleDeleteCombo(c._id)} className="p-2 rounded-xl bg-card border border-border hover:border-rose-200 hover:text-rose-500 transition-all shadow-sm"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.services.map(s => (
                            <span key={s._id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-card border border-border text-[9px] font-bold text-muted-foreground capitalize">
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
      </main>

      <AnimatePresence>
        {showForm && (
          <motion.div key="service-form-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-card text-left overflow-y-auto">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.3 }}
              className="w-full min-h-screen bg-card sm:max-w-md sm:mx-auto sm:min-h-0 sm:rounded-[32px] sm:border sm:border-border sm:shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-3 sticky top-0 bg-card z-10 text-foreground">
                <h3 className="text-lg font-black uppercase tracking-tighter">{editId ? "Edit Service" : "Add Service"}</h3>
                <button type="button" onClick={resetForm} className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 pb-32 space-y-5">
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
                  <div className="relative space-y-3">
                    <select
                      value={form.name}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setForm({ ...form, name: "custom" });
                        } else {
                          const selected = categoryServices.find(s => s.name === val);
                          const isSewak = user?.providerCategory === 'sewak';
                          setForm({
                            ...form,
                            name: val,
                            customName: "",
                            price: isSewak ? (selected?.basePrice) : "",

                          });
                        }
                      }}
                      className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none appearance-none"
                    >
                      <option value="">Select a service...</option>
                      {categoryServices.map(s => (
                        <option key={s._id} value={s.name}>{s.name}</option>
                      ))}
                      <option value="custom">Other (Customised Service)</option>
                    </select>
                    {form.name === "custom" && (
                      <input
                        type="text"
                        value={form.customName}
                        onChange={(e) => setForm({ ...form, customName: e.target.value })}
                        className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none"
                        placeholder="Enter customised service name..."
                      />
                    )}
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Description</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none" placeholder="Describe the service..." />
                </div>

                <div className="grid grid-cols-2 gap-3 text-left">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground flex items-center justify-between">
                      Service Price (₹)
                      {user?.providerCategory === 'sewak' && <span className="text-[7px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded uppercase">Master Rate</span>}
                    </label>
                    <input type="number" min="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                      readOnly={user?.providerCategory === 'sewak'}
                      className={`w-full rounded-2xl border border-border p-4 text-xs font-black focus:border-primary focus:outline-none ${user?.providerCategory === 'sewak' ? 'bg-slate-50 cursor-not-allowed opacity-80' : 'bg-background'}`} placeholder="299" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Duration</label>
                    <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none appearance-none">
                      {["15 min", "30 min", "45 min", "1 hr", "1.5 hrs", "2 hrs", "3 hrs", "4+ hrs"].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="text-left bg-muted/50 p-4 rounded-2xl flex items-center justify-between border border-border">
                  <div>
                    <p className="text-xs font-black text-foreground">Visible on Public Shop</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Turn off to use only in Combos</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <motion.button disabled={saving || uploading} whileTap={{ scale: 0.97 }} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-primary h-16 text-xs font-black uppercase tracking-[0.2em] text-primary-foreground shadow-2xl shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving..." : editId ? "Update Service" : "Add Service"}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
        {showComboForm && (
          <motion.div key="combo-form-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-card text-left overflow-y-auto">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.3 }}
              className="w-full min-h-screen bg-card sm:max-w-md sm:mx-auto sm:min-h-0 sm:rounded-[32px] sm:border sm:border-border sm:shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-3 sticky top-0 bg-card z-10 text-foreground">
                <h3 className="text-lg font-black uppercase tracking-tighter">{editId ? "Edit Combo" : "Create Combo"}</h3>
                <button type="button" onClick={resetComboForm} className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleComboSave} className="p-6 pb-32 space-y-5">
                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Banner Image</label>
                  <div className="group relative h-40 w-full overflow-hidden rounded-[24px] bg-emerald-50 dark:bg-emerald-950/20 border-2 border-dashed border-emerald-200 dark:border-emerald-800/50">
                    {comboForm.image ? (
                      <>
                        <img src={comboForm.image} className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setComboForm({ ...comboForm, image: "" })} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white dark:bg-slate-800 text-rose-500 shadow-md flex items-center justify-center"><X className="h-4 w-4" /></button>
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
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 min-h-[100px]">
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
                                price: catSvc.basePrice || 299
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
                              ? "bg-white dark:bg-emerald-900/40 text-emerald-600 border-emerald-100 dark:border-emerald-800"
                              : "bg-white dark:bg-slate-900 text-slate-400 border-dashed border-slate-300 dark:border-slate-700 italic"
                            }`}
                        >
                          {!isAdded && <Plus className="h-2.5 w-2.5" />}
                          {catSvc.name}
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse ml-1" />}
                        </button>
                      );
                    })}
                    {/* Render Custom Services */}
                    {services.filter(s => !categoryServices.some(catSvc => catSvc.name === s.name)).map((customSvc, i) => {
                      const isSelected = comboForm.services.includes(customSvc._id);
                      return (
                        <button
                          key={`custom-${i}`}
                          type="button"
                          onClick={() => {
                            const selected = comboForm.services.includes(customSvc._id);
                            setComboForm({
                              ...comboForm,
                              services: selected ? comboForm.services.filter(id => id !== customSvc._id) : [...comboForm.services, customSvc._id]
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 ${isSelected
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/20"
                            : "bg-white dark:bg-emerald-900/40 text-emerald-600 border-emerald-100 dark:border-emerald-800"
                          }`}
                        >
                          {customSvc.name} (Custom)
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse ml-1" />}
                        </button>
                      );
                    })}
                    {categoryServices.length === 0 && services.length === 0 && (
                      <p className="text-[10px] font-bold text-slate-400 text-center w-full py-4">Loading catalog...</p>
                    )}
                    <div className="w-full flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <input 
                        type="text" 
                        placeholder="Type custom service name to add..." 
                        value={newCustomService}
                        onChange={(e) => setNewCustomService(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[10px] font-bold focus:outline-none focus:border-emerald-500"
                      />
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!newCustomService.trim()) return;
                          const payload = {
                            name: newCustomService.trim(),
                            description: `Custom ${newCustomService.trim()} service`,
                            duration: "1 hour",
                            visible: false,
                            category: categoryName,
                            price: 299
                          };
                          try {
                            const { data } = await API.post("/services", payload);
                            setServices(prev => [...prev, data]);
                            setComboForm(prev => ({ ...prev, services: [...prev.services, data._id] }));
                            setNewCustomService("");
                          } catch (err) {
                            toast({ title: "Failed to add custom service", variant: "destructive" });
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Combo Display Price ₹ *</label>
                  <input type="number" required value={comboForm.price} onChange={e => setComboForm({ ...comboForm, price: e.target.value })}
                    className="w-full rounded-2xl border border-border bg-background p-4 text-xs font-black focus:border-emerald-500" placeholder="Bundle Price" />
                </div>

                <motion.button disabled={saving || uploading} whileTap={{ scale: 0.97 }} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-emerald-600 h-16 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving..." : editId ? "Update Combo" : "Launch Combo Offer"}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* View Service Details Modal */}
        <AnimatePresence>
          {viewService && (
            <motion.div key="view-service-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-card w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]">
                {viewService.image && (
                  <div className="w-full h-48 bg-muted shrink-0 relative">
                    <img src={viewService.image} alt={viewService.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent"></div>
                  </div>
                )}
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-black text-foreground">{viewService.name}</h3>
                      <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{viewService.category}</p>
                    </div>
                    {!viewService.visible && <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[9px] uppercase font-bold">Combo Only</span>}
                  </div>
                  
                  <p className="text-xs text-muted-foreground font-medium mb-6 leading-relaxed">{viewService.description}</p>
                  
                  <div className="space-y-4">
                    <div className="bg-muted/50 rounded-2xl p-4 border border-border/50">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Pricing Tiers</p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-foreground">Basic</span>
                          <span className="font-black text-primary">₹{viewService.pricing?.basic}</span>
                        </div>
                        {viewService.pricing?.standard > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-foreground">Standard</span>
                            <span className="font-black text-primary">₹{viewService.pricing.standard}</span>
                          </div>
                        )}
                        {viewService.pricing?.premium > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-foreground">Premium</span>
                            <span className="font-black text-primary">₹{viewService.pricing.premium}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-2xl p-4 border border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Duration</p>
                        <p className="text-sm font-bold text-foreground">{viewService.duration}</p>
                      </div>
                      {viewService.pricing?.express > 0 && (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1 flex items-center gap-1"><Zap className="h-3 w-3" /> Express</p>
                          <p className="text-sm font-bold text-amber-700">+₹{viewService.pricing.express}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-card border-t border-border shrink-0">
                  <button onClick={() => setViewService(null)} className="w-full h-14 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-xs">Close Details</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderServices;
