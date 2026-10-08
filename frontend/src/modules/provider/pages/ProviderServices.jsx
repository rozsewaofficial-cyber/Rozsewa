import { useState, useEffect, useMemo } from "react";
import { useScrollLock } from "@/lib/scrollLock";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Edit3, Trash2, Eye, EyeOff, X, Save, IndianRupee, Loader2, Gift, Camera, Zap, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import ServiceVisual from "@/components/ServiceVisual";

// How long a job takes. Every service used to be saved as "30 min" or
// "1 hour" without the partner ever being asked.
const DURATION_OPTIONS = ["15 min", "30 min", "45 min", "1 hour", "1.5 hours", "2 hours", "3 hours", "4 hours", "Half day", "Full day"];
const MAX_PRICE = 100000;
const nameKey = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ProviderServices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [combos, setCombos] = useState([]);
  const [categoryServices, setCategoryServices] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const draft = JSON.parse(sessionStorage.getItem("provider-services-draft") || "{}");
  const [activeTab, setActiveTab] = useState(draft.activeTab || "services"); // "services" or "combos"
  const [showForm, setShowForm] = useState(draft.showForm || false);
  const [showComboForm, setShowComboForm] = useState(draft.showComboForm || false);
  const [errors, setErrors] = useState({});
  const [editId, setEditId] = useState(draft.editId || null);
  const [form, setForm] = useState(draft.form || { name: "", customName: "", description: "", basic: "", standard: "", premium: "", express: "", duration: "", serviceType: ["home"], visible: true, image: "", amenities: [], serviceDetails: [], subcategory: "" });
  const [viewService, setViewService] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useScrollLock(showForm || showComboForm || !!viewService);

  const [comboForm, setComboForm] = useState(draft.comboForm || { name: "", description: "", services: [], price: "", image: "" });

  useEffect(() => {
    sessionStorage.setItem("provider-services-draft", JSON.stringify({
      activeTab, showForm, showComboForm, editId, form, comboForm
    }));
  }, [activeTab, showForm, showComboForm, editId, form, comboForm]);

  const clearDraft = () => sessionStorage.removeItem("provider-services-draft");
  const [uploading, setUploading] = useState(false);
  const [serviceSubTab, setServiceSubTab] = useState("active"); // "active" or "hidden"
  const [saving, setSaving] = useState(false);
  const [newCustomService, setNewCustomService] = useState("");
  const [newAmenity, setNewAmenity] = useState("");
  const [newServiceDetail, setNewServiceDetail] = useState("");

  const { user } = useAuth();

  // Services the backend flagged as locked behind an incomplete Skill Session.
  const skillGated = [...services, ...categoryServices].filter(
    (s, i, arr) => s?.locked && arr.findIndex(x => x.name === s.name) === i
  );

  useEffect(() => {
    fetchProviderInfoAndServices();
  }, [user]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const { compressImage } = await import('@/lib/imageCompression');
      const compressedFile = await compressImage(file, 800, 800, 0.7);

      const formData = new FormData();
      formData.append("image", compressedFile);

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

  const [allCategories, setAllCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryServices, setSubcategoryServices] = useState([]);

  useEffect(() => {
    const catName = form.category || categoryName;
    const catObj = allCategories.find(c => c.name === catName);
    if (catObj && catObj._id) {
      API.get(`/public/categories/${catObj._id}/subcategories`)
        .then(res => setSubcategories(res.data || []))
        .catch(() => setSubcategories([]));
    } else {
      setSubcategories([]);
    }
  }, [form.category, categoryName, allCategories]);

  useEffect(() => {
    const subName = form.subcategory;
    const subObj = subcategories.find(s => s.name === subName);
    if (subObj && subObj._id) {
      API.get(`/public/subcategories/${subObj._id}/services`)
        .then(res => setSubcategoryServices(res.data || []))
        .catch(() => setSubcategoryServices([]));
    } else {
      setSubcategoryServices([]);
    }
  }, [form.subcategory, subcategories]);

  // The services admin offers in this category (the same catalog customers
  // browse: Partner Program catalog rows plus the category's own list), each
  // with its subcategory and photo, so they can be shown grouped.
  const [catalog, setCatalog] = useState([]);
  const isSewakUser = user?.providerCategory === "sewak";
  const categoryObj = allCategories.find(c => c.name === categoryName);
  useEffect(() => {
    if (isSewakUser || !categoryObj?._id) return;
    let cancelled = false;
    API.get("/public/subcategories/all/services", {
      params: { categoryId: categoryObj._id, category: categoryObj.name, includeZeroPrice: "true" }
    })
      .then(({ data }) => {
        if (!cancelled) setCatalog((Array.isArray(data) ? data : []).filter(c => c.visibleTo !== "sewak"));
      })
      .catch(() => { if (!cancelled) setCatalog([]); });
    return () => { cancelled = true; };
  }, [categoryObj?._id, isSewakUser]);

  const catalogGroups = useMemo(() => {
    const groups = subcategories.map(sub => ({ key: String(sub._id), name: sub.name, image: sub.image, items: [] }));
    const other = { key: "other", name: subcategories.length ? "Other services" : categoryName, items: [] };
    for (const item of catalog) {
      const group = groups.find(g => (item.subcategoryId && g.key === String(item.subcategoryId)) || (item.subcategory && nameKey(g.name) === nameKey(item.subcategory)));
      (group || other).items.push(item);
    }
    return [...groups, other].filter(g => g.items.length > 0);
  }, [catalog, subcategories, categoryName]);

  const ownedService = (name) => services.find(sv => nameKey(sv.name) === nameKey(name));

  // The combo picker offers the same catalog (subcategory services included);
  // a Sewak has no partner catalog and keeps the category list.
  // A Sewak works at admin's Master Rate, so only services with one are offered.
  const comboCatalog = isSewakUser
    ? categoryServices.filter(c => Number(c.basePrice ?? c.price) > 0)
    : (catalog.length > 0 ? catalog : categoryServices);

  // A catalog service picked for a combo that the partner doesn't offer yet:
  // they enter its price and duration first. It used to be added on the spot
  // at the catalog price, or ₹299, for "1 hour".
  const [comboPending, setComboPending] = useState(null);
  const addPendingToCombo = async () => {
    const { item, price, duration } = comboPending;
    const p = Number(price);
    let error = "";
    if (price === "" || !Number.isFinite(p) || p < 1) error = "Enter your price for this service";
    else if (p > MAX_PRICE) error = `Price can't be more than ₹${MAX_PRICE.toLocaleString("en-IN")}`;
    else if (!duration) error = "Choose how long the job takes";
    if (error) { setComboPending({ ...comboPending, error }); return; }
    setComboPending({ ...comboPending, error: "", saving: true });
    try {
      const { data } = await API.post("/services", {
        name: item.name,
        description: item.description || "",
        duration,
        visible: false, // offered only inside the combo until the partner shows it
        image: item.image || "",
        amenities: item.amenities || [],
        serviceDetails: item.serviceDetails || [],
        serviceType: Array.isArray(item.serviceType) && item.serviceType.length ? item.serviceType : ["home"],
        subcategory: item.subcategory || subcategories.find(sub => String(sub._id) === String(item.subcategoryId))?.name || undefined,
        category: categoryName,
        price: p
      });
      setServices(prev => [...prev, data]);
      setComboForm(prev => ({ ...prev, services: [...prev.services, data._id] }));
      setComboPending(null);
    } catch (err) {
      setComboPending(prev => prev && { ...prev, saving: false, error: err.response?.data?.message || "Couldn't add this service" });
    }
  };

  const fetchProviderInfoAndServices = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [servicesRes, catRes] = await Promise.all([
        API.get("/services"),
        API.get("/provider/categories").catch(() => ({ data: [] }))
      ]);
      setServices(servicesRes.data.services || []);
      setCombos(servicesRes.data.combos || []);
      setCategoryServices(servicesRes.data.categoryServices || []);
      setCategoryName(servicesRes.data.categoryName || "Your Category");
      setAllCategories(catRes.data || []);
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

    const newErrors = {};
    if (!editId && subcategories.length > 0 && !form.subcategory) newErrors.subcategory = "Choose a subcategory";
    if (!finalName) newErrors.name = "Service Name is required";
    const price = Number(form.price);
    if (form.price === "" || form.price === undefined || form.price === null) newErrors.price = "Enter your price for this service";
    else if (!Number.isFinite(price) || price < 1) newErrors.price = "Price must be at least ₹1";
    else if (price > MAX_PRICE) newErrors.price = `Price can't be more than ₹${MAX_PRICE.toLocaleString("en-IN")}`;
    if (!form.duration) newErrors.duration = "Choose how long the job takes";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setSaving(true);

    const payload = {
      name: finalName,
      description: form.description,
      duration: form.duration,
      serviceType: form.serviceType && form.serviceType.length > 0 ? form.serviceType : ["home"],
      visible: form.visible,
      image: form.image,
      amenities: form.amenities || [],
      serviceDetails: form.serviceDetails || [],
      category: form.category || categoryName,
      subcategory: form.subcategory,
      price: Number(form.price) || 0,
    };

    try {
      if (editId) {
        await API.put(`/services/${editId}`, payload);
        toast({ title: "Success!", description: "Service updated successfully." });
        fetchProviderInfoAndServices(false);
        resetForm();
      } else {
        await API.post("/services", payload);
        toast({ title: "Success!", description: "New service created successfully." });
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
        toast({ title: "Success!", description: "Combo updated successfully." });
        fetchProviderInfoAndServices(false);
        resetComboForm();
      } else {
        await API.post("/services/combos", comboForm);
        toast({ title: "Success!", description: "New combo created successfully." });
        fetchProviderInfoAndServices(false);
        resetComboForm();
      }
    } catch (err) {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // A catalog service opens the full details form for the partner to fill
  // in: their own price and duration. ("Quick Add" used to add it at once at
  // the catalog price, or ₹299 when it had none.) One already added opens
  // for editing instead of being added twice.
  const openServiceForm = (item) => {
    const existing = ownedService(item.name);
    if (existing) { handleEdit(existing); return; }
    setErrors({});
    setForm({
      name: item.name,
      customName: "",
      description: item.description || "",
      price: "",
      duration: "",
      visible: true,
      image: item.image || "",
      catalogImage: item.image || "",
      catalogDescription: item.description || "",
      amenities: item.amenities || [],
      serviceDetails: item.serviceDetails || [],
      serviceType: Array.isArray(item.serviceType) ? item.serviceType : (item.serviceType ? [item.serviceType] : ["home"]),
      subcategory: item.subcategory || subcategories.find(sub => String(sub._id) === String(item.subcategoryId))?.name || "",
      category: categoryName,
      suggestedPrice: Number(item.basePrice ?? item.price) > 0 ? Number(item.basePrice ?? item.price) : null,
    });
    setEditId(null);
    setShowForm(true);
  };

  const resetForm = () => { setForm({ name: "", customName: "", description: "", price: "", duration: "", visible: true, image: "", amenities: [], serviceDetails: [], subcategory: "" }); setShowForm(false); setEditId(null); setNewAmenity(""); setNewServiceDetail(""); clearDraft(); setErrors({}); };
  const resetComboForm = () => { setComboForm({ name: "", description: "", services: [], price: "", image: "" }); setComboPending(null); setShowComboForm(false); setEditId(null); clearDraft(); setErrors({}); };

  const handleEdit = (s) => {
    const isCustom = !categoryServices.some(cat => cat.name === s.name) && !catalog.some(cat => nameKey(cat.name) === nameKey(s.name));
    setForm({
      name: isCustom ? "custom" : s.name,
      customName: isCustom ? s.name : "",
      description: s.description,
      price: s.price || "",
      duration: s.duration || "",
      visible: s.visible,
      image: s.image || "",
      amenities: s.amenities || [],
      serviceDetails: s.serviceDetails || [],
      serviceType: Array.isArray(s.serviceType) && s.serviceType.length ? s.serviceType : ["home"],
      subcategory: s.subcategory || ""
    });
    setErrors({});
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
      {!showForm && !showComboForm && <ProviderTopNav title="Service Hub" />}
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
            {/* Skill Session gate — services held until training is complete */}
            {skillGated.length > 0 && !showForm && !showComboForm && (
              <motion.button
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate("/provider/skill-sessions")}
                className="mb-6 w-full flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-left hover:border-amber-300 transition-colors"
              >
                <div className="rounded-xl bg-white dark:bg-amber-950/60 p-2.5 shrink-0">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                    Skill Session Required
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {skillGated.length} service{skillGated.length === 1 ? "" : "s"} waiting on training:{" "}
                    {skillGated.map(s => s.name).slice(0, 2).join(", ")}
                    {skillGated.length > 2 ? ` +${skillGated.length - 2} more` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Book
                </span>
              </motion.button>
            )}

            {/* Catalog for this category, grouped by subcategory */}
            {catalogGroups.length > 0 && !showForm && !showComboForm && activeTab === "services" && !isSewakUser && (
              <section className="space-y-5 mb-8">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Gift className="h-4 w-4 text-emerald-500" /> Catalog for {categoryName}
                  </h2>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 uppercase">Tap to add</span>
                </div>
                {catalogGroups.map(group => (
                  <div key={group.key} className="space-y-2.5">
                    <div className="flex items-center gap-2 px-1">
                      {group.image && <img src={group.image} alt="" className="h-6 w-6 rounded-md object-cover" />}
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-foreground">{group.name}</h3>
                      <span className="text-[10px] font-bold text-muted-foreground">{group.items.length}</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
                      {group.items.map(item => {
                        const owned = ownedService(item.name);
                        const suggested = Number(item.basePrice ?? item.price) > 0 ? Number(item.basePrice ?? item.price) : null;
                        return (
                          <motion.button
                            key={item._id || item.name}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => openServiceForm(item)}
                            className={`w-36 shrink-0 overflow-hidden rounded-2xl border text-left transition-all ${owned ? "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/30" : "border-border bg-card hover:border-emerald-500"}`}
                          >
                            <div className="relative h-20 w-full bg-muted">
                              <ServiceVisual src={item.image} name={item.name} hint={`${item.description || ""} ${categoryName}`} iconClassName="h-7 w-7" />
                              {owned && (
                                <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[8px] font-black uppercase text-white shadow">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Added
                                </span>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-[11px] font-black leading-tight text-foreground line-clamp-2">{item.name}</p>
                              <p className="mt-1 text-[10px] font-bold text-emerald-600">
                                {owned ? `Your price ₹${owned.price}` : (suggested ? `Catalog ₹${suggested}` : "Set your price")}
                              </p>
                              <p className="mt-1.5 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                                {owned ? <><Edit3 className="h-2.5 w-2.5" /> Edit</> : <><Plus className="h-2.5 w-2.5" /> Add details</>}
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
                  <div className="h-28 w-full relative bg-muted">
                    <ServiceVisual src={s.image} name={s.name} hint={`${s.description || ""} ${categoryName}`} iconClassName="h-9 w-9" />
                    {s.image && <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent" />}
                  </div>
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
                      {s.duration && <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-600 dark:text-slate-300">{s.duration}</span>}
                      {s.subcategory && <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-600 dark:text-slate-300">{s.subcategory}</span>}
                    </div>
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
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ type: "tween", duration: 0.3 }}
              className="w-full bg-card max-w-md mx-auto rounded-[32px] overflow-hidden border border-border shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-card shrink-0">
                <h3 className="text-lg font-black uppercase tracking-tighter">{editId ? "Edit Service" : "Add Service"}</h3>
                <button type="button" onClick={resetForm} className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Service Photo</label>
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upload a photo of your work</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Category *</label>
                  <select
                    disabled
                    value={categoryName}
                    className="w-full rounded-2xl border border-border bg-slate-50 dark:bg-slate-900 p-4 text-xs font-bold focus:outline-none appearance-none cursor-not-allowed opacity-80"
                  >
                    <option value={categoryName}>{categoryName}</option>
                  </select>
                </div>

                {subcategories.length > 0 && (
                  <div className="text-left">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Subcategory *</label>
                    <select
                      disabled={!!editId}
                      value={form.subcategory || ""}
                      onChange={e => {
                        // While editing, the service itself stays (its name can't be
                        // changed); only its subcategory is set.
                        if (editId) {
                          setForm({ ...form, subcategory: e.target.value });
                          setErrors(prev => ({ ...prev, subcategory: undefined }));
                          return;
                        }
                        setForm({
                          ...form,
                          subcategory: e.target.value,
                          name: "",
                          price: "",
                          image: form.image && form.image !== form.catalogImage ? form.image : "",
                          catalogImage: "",
                          description: form.description && form.description !== form.catalogDescription ? form.description : "",
                          catalogDescription: "",
                          suggestedPrice: null
                        });
                        setErrors(prev => ({ ...prev, subcategory: undefined, name: undefined }));
                      }}
                      className={`w-full rounded-2xl border ${errors.subcategory ? 'border-rose-500' : 'border-border'} p-4 text-xs font-bold focus:border-primary focus:outline-none appearance-none ${!!editId ? 'bg-slate-50 dark:bg-slate-900 cursor-not-allowed opacity-80' : 'bg-background'}`}
                    >
                      <option value="">Select a subcategory...</option>
                      {subcategories.map(sub => (
                        <option key={sub._id} value={sub.name}>{sub.name}</option>
                      ))}
                    </select>
                    {errors.subcategory && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.subcategory}</p>}
                  </div>
                )}

                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Service Name *</label>
                  <div className="relative space-y-3">
                    <select
                      disabled={!!editId}
                      value={form.name}
                      onChange={e => {
                        const val = e.target.value;
                        let currentSvcs = [];
                        if (form.subcategory && subcategoryServices.length > 0) {
                          currentSvcs = subcategoryServices;
                        } else {
                          const selectedCatName = form.category || categoryName;
                          const selectedCatObj = allCategories.find(c => c.name === selectedCatName);
                          currentSvcs = (selectedCatName === categoryName)
                            ? categoryServices
                            : (selectedCatObj?.services || categoryServices);
                        }
                        const selected = currentSvcs.find(s => s.name === val);
                        const isSewak = user?.providerCategory === 'sewak';
                        const p = selected?.basePrice !== undefined ? selected?.basePrice : selected?.price;
                        setErrors(prev => ({ ...prev, name: undefined }));
                        setForm({
                          ...form,
                          name: val,
                          customName: "",
                          // A partner sets their own price; the catalog's is offered as a suggestion.
                          price: isSewak ? p : "",
                          suggestedPrice: !isSewak && Number(p) > 0 ? Number(p) : null,
                          // The new service's photo and description replace the
                          // previous service's; the partner's own upload or text stays.
                          image: form.image && form.image !== form.catalogImage ? form.image : (selected?.image || ""),
                          catalogImage: selected?.image || "",
                          description: form.description && form.description !== form.catalogDescription ? form.description : (selected?.description || ""),
                          catalogDescription: selected?.description || "",
                          amenities: selected?.amenities || [],
                          serviceDetails: selected?.serviceDetails || [],
                          serviceType: Array.isArray(selected?.serviceType) ? selected.serviceType : (selected?.serviceType ? [selected.serviceType] : ["home"])
                        });
                      }}
                      className={`w-full rounded-2xl border border-border p-4 text-xs font-bold focus:border-primary focus:outline-none appearance-none ${!!editId ? 'bg-slate-50 dark:bg-slate-900 cursor-not-allowed opacity-80' : 'bg-background'}`}
                    >
                      <option value="">Select a service...</option>
                      {(() => {
                        if (form.subcategory && subcategoryServices.length > 0) return subcategoryServices;
                        const catName = form.category || categoryName;
                        if (catName === categoryName) return categoryServices;
                        return allCategories.find(c => c.name === catName)?.services || categoryServices;
                      })().filter(s => {
                        const p = s.basePrice !== undefined ? s.basePrice : s.price;
                        if (user?.providerCategory !== 'sewak' && s.visibleTo === 'sewak') return false;
                        return user?.providerCategory !== 'sewak' || Number(p) > 0;
                      }).concat(
                        // Editing a service that isn't in the current list (e.g. from
                        // a subcategory catalog) still shows its name.
                        editId && form.name ? [{ name: form.name, label: form.name === "custom" ? form.customName : form.name, _id: "__current" }] : []
                      ).filter((s, i, list) => list.findIndex(x => x.name === s.name) === i).map(s => (
                        <option key={s._id || s.name} value={s.name}>{s.label || s.name}</option>
                      ))}
                    </select>
                    {errors.name && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.name}</p>}
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
                      Service Price (₹) *
                      {user?.providerCategory === 'sewak' && <span className="text-[7px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded uppercase">Master Rate</span>}
                    </label>
                    <input type="number" min="1" max={MAX_PRICE} inputMode="numeric" placeholder="Your price" value={form.price} onChange={e => { setForm({ ...form, price: e.target.value }); setErrors(prev => ({ ...prev, price: undefined })); }}
                      onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                      readOnly={user?.providerCategory === 'sewak'}
                      className={`w-full rounded-2xl border ${errors.price ? 'border-rose-500' : 'border-border'} p-4 text-xs font-black focus:border-primary focus:outline-none ${user?.providerCategory === 'sewak' ? 'bg-slate-50 cursor-not-allowed opacity-80' : 'bg-background'}`} />
                    {errors.price && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.price}</p>}
                    {!errors.price && form.suggestedPrice && String(form.price) !== String(form.suggestedPrice) && user?.providerCategory !== 'sewak' && (
                      <button type="button" onClick={() => setForm({ ...form, price: String(form.suggestedPrice) })}
                        className="mt-1.5 text-[10px] font-bold text-emerald-600 hover:underline">
                        Use catalog price ₹{form.suggestedPrice}
                      </button>
                    )}

                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mt-4 mb-2 text-muted-foreground">Time / Duration *</label>
                    <select
                      value={form.duration || ""}
                      onChange={e => { setForm({ ...form, duration: e.target.value }); setErrors(prev => ({ ...prev, duration: undefined })); }}
                      className={`w-full rounded-2xl border ${errors.duration ? 'border-rose-500' : 'border-border'} bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none appearance-none`}
                    >
                      <option value="">How long does it take?</option>
                      {[...DURATION_OPTIONS, ...(form.duration && !DURATION_OPTIONS.includes(form.duration) ? [form.duration] : [])].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {errors.duration && <p className="text-[10px] text-rose-500 font-bold mt-1">{errors.duration}</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Service Types</label>
                    <div className="flex flex-col gap-2">
                      {[
                        { id: 'home', label: 'Home Visit' },
                        { id: 'shop', label: 'Shop Visit' },
                        { id: '24x7', label: '24x7 Emergency' }
                      ].map(type => (
                        <label key={type.id} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${form.serviceType?.includes(type.id) ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={form.serviceType?.includes(type.id) || false}
                            onChange={(e) => {
                              const current = Array.isArray(form.serviceType) ? form.serviceType : [form.serviceType].filter(Boolean);
                              if (e.target.checked) {
                                setForm({ ...form, serviceType: [...current, type.id] });
                              } else {
                                setForm({ ...form, serviceType: current.filter(t => t !== type.id) });
                              }
                            }}
                          />
                          <div className={`h-4 w-4 rounded-[6px] border flex items-center justify-center ${form.serviceType?.includes(type.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-slate-300 dark:border-slate-600'}`}>
                            {form.serviceType?.includes(type.id) && <CheckCircle2 className="h-3 w-3" />}
                          </div>
                          <span className="text-xs font-bold text-foreground">{type.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Amenities / Inclusions</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newAmenity}
                      onChange={e => setNewAmenity(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newAmenity.trim()) {
                            setForm({ ...form, amenities: [...(form.amenities || []), newAmenity.trim()] });
                            setNewAmenity("");
                          }
                        }
                      }}
                      className="flex-1 rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none"
                      placeholder="e.g. Bringing own equipment"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newAmenity.trim()) {
                          setForm({ ...form, amenities: [...(form.amenities || []), newAmenity.trim()] });
                          setNewAmenity("");
                        }
                      }}
                      className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-6 font-black uppercase text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {form.amenities && form.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {form.amenities.map((amenity, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                          {amenity}
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, amenities: form.amenities.filter((_, i) => i !== idx) })}
                            className="ml-1 text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-muted-foreground">Service Details / Inclusions</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newServiceDetail}
                      onChange={e => setNewServiceDetail(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newServiceDetail.trim()) {
                            setForm({ ...form, serviceDetails: [...(form.serviceDetails || []), newServiceDetail.trim()] });
                            setNewServiceDetail("");
                          }
                        }
                      }}
                      className="flex-1 rounded-2xl border border-border bg-background p-4 text-xs font-bold focus:border-primary focus:outline-none"
                      placeholder="e.g. Deep cleaning of all surfaces"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newServiceDetail.trim()) {
                          setForm({ ...form, serviceDetails: [...(form.serviceDetails || []), newServiceDetail.trim()] });
                          setNewServiceDetail("");
                        }
                      }}
                      className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-6 font-black uppercase text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {form.serviceDetails && form.serviceDetails.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3">
                      {form.serviceDetails.map((detail, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 px-3 py-2 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                          <span>{idx + 1}. {detail}</span>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, serviceDetails: form.serviceDetails.filter((_, i) => i !== idx) })}
                            className="ml-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ type: "tween", duration: 0.3 }}
              className="w-full bg-card max-w-md mx-auto rounded-[32px] overflow-hidden border border-border shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-card shrink-0 text-foreground">
                <h3 className="text-lg font-black uppercase tracking-tighter">{editId ? "Edit Combo" : "Create Combo"}</h3>
                <button type="button" onClick={resetComboForm} className="rounded-full h-10 w-10 flex items-center justify-center hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleComboSave} className="p-6 space-y-5 overflow-y-auto flex-1">
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
                          try {
                            const { compressImage } = await import('@/lib/imageCompression');
                            const compressedFile = await compressImage(file, 800, 800, 0.7);
                            const fd = new FormData(); fd.append("image", compressedFile);
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
                    {comboCatalog.filter(c => isSewakUser || c.visibleTo !== "sewak").map((catSvc, i) => {
                      const existingSvc = ownedService(catSvc.name);
                      const isSelected = existingSvc && comboForm.services.includes(existingSvc._id);
                      const isAdded = !!existingSvc;
                      const isPending = comboPending && comboPending.item.name === catSvc.name;

                      return (
                        <button
                          key={catSvc._id || i}
                          type="button"
                          onClick={() => {
                            if (!isAdded) {
                              setComboPending(isPending ? null : { item: catSvc, price: "", duration: "", error: "" });
                              return;
                            }
                            setComboForm({
                              ...comboForm,
                              services: isSelected ? comboForm.services.filter(id => id !== existingSvc._id) : [...comboForm.services, existingSvc._id]
                            });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 ${isSelected
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-600/20"
                            : isAdded
                              ? "bg-white dark:bg-emerald-900/40 text-emerald-600 border-emerald-100 dark:border-emerald-800"
                              : isPending
                                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 border-amber-300"
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
                    {services.filter(s => !comboCatalog.some(catSvc => nameKey(catSvc.name) === nameKey(s.name))).map((customSvc, i) => {
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
                    {comboCatalog.length === 0 && services.length === 0 && (
                      <p className="text-[10px] font-bold text-slate-400 text-center w-full py-4">Loading catalog...</p>
                    )}
                  </div>
                  {comboPending && (
                    <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
                      <p className="text-[11px] font-black text-foreground">
                        Add “{comboPending.item.name}” to your services
                        <span className="block text-[10px] font-bold text-muted-foreground mt-0.5">Set your price and time for it; it's added to this combo.</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" min="1" max={MAX_PRICE} inputMode="numeric" placeholder="Your price ₹"
                          value={comboPending.price}
                          onChange={e => setComboPending({ ...comboPending, price: e.target.value, error: "" })}
                          className="w-full rounded-xl border border-border bg-background p-3 text-xs font-bold focus:border-emerald-500 focus:outline-none" />
                        <select value={comboPending.duration}
                          onChange={e => setComboPending({ ...comboPending, duration: e.target.value, error: "" })}
                          className="w-full rounded-xl border border-border bg-background p-3 text-xs font-bold focus:border-emerald-500 focus:outline-none">
                          <option value="">Duration</option>
                          {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      {Number(comboPending.item.basePrice ?? comboPending.item.price) > 0 && String(comboPending.price) !== String(comboPending.item.basePrice ?? comboPending.item.price) && (
                        <button type="button" onClick={() => setComboPending({ ...comboPending, price: String(comboPending.item.basePrice ?? comboPending.item.price), error: "" })}
                          className="text-[10px] font-bold text-emerald-600 hover:underline">
                          Use catalog price ₹{comboPending.item.basePrice ?? comboPending.item.price}
                        </button>
                      )}
                      {comboPending.error && <p className="text-[10px] text-rose-500 font-bold">{comboPending.error}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setComboPending(null)}
                          className="flex-1 rounded-xl border border-border py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Cancel</button>
                        <button type="button" disabled={comboPending.saving} onClick={addPendingToCombo}
                          className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-60">
                          {comboPending.saving ? "Adding..." : "Add to combo"}
                        </button>
                      </div>
                    </div>
                  )}
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
