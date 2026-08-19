import { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Plus, X, Save, Trash2, Loader2, Search, IndianRupee } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const emptyForm = { name: "", categoryId: "", description: "", items: [], comboPrice: 0, isActive: true };

const AdminKitCombos = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [combos, setCombos] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  useScrollLock(showModal);

  useEffect(() => { setTitle("Combo Packs"); }, [setTitle]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [combosRes, itemsRes, catsRes] = await Promise.all([
        API.get("/admin/kit-combos"),
        API.get("/admin/starter-kit-items"),
        API.get("/admin/categories").catch(() => ({ data: [] })),
      ]);
      setCombos(combosRes.data || []);
      setItems(itemsRes.data || []);
      setCategories(catsRes.data || []);
    } catch {
      toast({ title: "Could not load combo packs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Items must belong to the combo's category — the picker enforces it.
  const selectableItems = useMemo(
    () => items.filter((i) => (i.categoryId?._id || i.categoryId) === form.categoryId && i.isActive !== false),
    [items, form.categoryId]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: catFilter || categories[0]?._id || "" });
    setShowModal(true);
  };

  const openEdit = (combo) => {
    setEditing(combo);
    setForm({
      name: combo.name || "",
      categoryId: combo.categoryId?._id || combo.categoryId || "",
      description: combo.description || "",
      items: (combo.items || []).map((i) => String(i.itemId)),
      comboPrice: combo.comboPrice ?? 0,
      isActive: combo.isActive !== false,
    });
    setShowModal(true);
  };

  const handleCategoryChange = (categoryId) => {
    // Drop any selected item that the new category doesn't offer.
    const allowed = items.filter((i) => (i.categoryId?._id || i.categoryId) === categoryId).map((i) => String(i._id));
    setForm((f) => ({ ...f, categoryId, items: f.items.filter((id) => allowed.includes(id)) }));
  };

  const toggleItem = (id) =>
    setForm((f) => ({ ...f, items: f.items.includes(id) ? f.items.filter((x) => x !== id) : [...f.items, id] }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Combo name is required", variant: "destructive" });
    if (!form.categoryId) return toast({ title: "Select a category", variant: "destructive" });
    if (!form.items.length) return toast({ title: "Select at least one item", variant: "destructive" });
    if (Number(form.comboPrice) < 0) return toast({ title: "Price cannot be negative", variant: "destructive" });

    const payload = { ...form, items: form.items.map((id) => ({ itemId: id })) };

    setSaving(true);
    try {
      if (editing) {
        await API.put(`/admin/kit-combos/${editing._id}`, payload);
        toast({ title: "Combo pack updated" });
      } else {
        await API.post("/admin/kit-combos", payload);
        toast({ title: "Combo pack created" });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast({ title: "Save failed", description: err.response?.data?.message || "Could not save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (combo) => {
    if (!window.confirm(`Remove "${combo.name}"?`)) return;
    try {
      await API.delete(`/admin/kit-combos/${combo._id}`);
      toast({ title: "Combo pack removed" });
      fetchAll();
    } catch (err) {
      toast({ title: "Could not remove", description: err.response?.data?.message || "Delete failed.", variant: "destructive" });
    }
  };

  const filtered = combos.filter((c) => {
    if (catFilter && (c.categoryId?._id || c.categoryId) !== catFilter) return false;
    if (!search) return true;
    return c.name?.toLowerCase().includes(search.toLowerCase());
  });

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500";
  const labelCls = "block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search combo packs..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button onClick={openCreate} disabled={items.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
          <Plus className="h-4 w-4" /> Add Combo
        </button>
      </div>

      {items.length === 0 && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
          Create starter kit items first — a combo pack is built from them.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
          <Layers className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">No combo packs yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((combo) => (
            <motion.div key={combo._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{combo.name}</h3>
                    {!combo.isActive && (
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Inactive</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{combo.categoryId?.name || "—"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(combo)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">Edit</button>
                  <button onClick={() => handleDelete(combo)} className="p-1.5 text-slate-400 hover:text-red-500" aria-label="Remove combo"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Included — quantities inherited from each item</p>
                {(combo.items || []).map((i) => (
                  <div key={String(i.itemId)} className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${i.missing ? "text-red-500 italic" : "text-slate-700 dark:text-slate-300"}`}>{i.name}</span>
                    <span className="font-black tabular-nums text-slate-500">x{i.kitQuantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Combo Price</span>
                <span className="flex items-center text-lg font-black text-emerald-600 tabular-nums">
                  <IndianRupee className="h-4 w-4" />{combo.comboPrice}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
            <motion.form initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} onSubmit={handleSave}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? "Edit Combo Pack" : "New Combo Pack"}</h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div>
                <label className={labelCls}>Category *</label>
                <select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)} className={inputCls} required>
                  <option value="">— Select a category —</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Combo Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Electrician Starter Pack" required />
              </div>

              <div>
                <label className={labelCls}>Starter Kits Included *</label>
                {!form.categoryId ? (
                  <p className="text-xs text-slate-400 italic">Select a category first.</p>
                ) : selectableItems.length === 0 ? (
                  <p className="text-xs text-amber-600">No active items in this category yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                    {selectableItems.map((i) => {
                      const on = form.items.includes(String(i._id));
                      return (
                        <button
                          key={i._id}
                          type="button"
                          onClick={() => toggleItem(String(i._id))}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${on ? "bg-emerald-50 dark:bg-emerald-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                              {on && <span className="text-[9px] font-black text-white">✓</span>}
                            </span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{i.name}</span>
                          </span>
                          <span className="text-xs font-black tabular-nums text-slate-400">x{i.kitQuantity}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Quantities aren't entered here — each item brings its own, set when the item was created.
                </p>
              </div>

              <div>
                <label className={labelCls}>Combo Price (₹) *</label>
                <input type="number" min="0" value={form.comboPrice} onChange={(e) => setForm({ ...form, comboPrice: Number(e.target.value) })} className={inputCls} required />
                <p className="mt-1 text-[11px] text-slate-400">Your own total for the pack — independent of the individual item prices.</p>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active — visible to Sewaks</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editing ? "Save Changes" : "Create Combo"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminKitCombos;
