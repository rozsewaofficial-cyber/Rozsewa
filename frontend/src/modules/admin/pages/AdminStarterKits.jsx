import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, X, Save, Trash2, Loader2, Search, AlertTriangle,
  Boxes, IndianRupee, PackageCheck
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const emptyForm = {
  name: "",
  categoryId: "",
  description: "",
  availableStock: 0,
  kitQuantity: 1,
  price: 0,
  isMandatory: false,
  isActive: true,
  lowStockThreshold: 5,
};

const stateStyle = {
  backorder: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  out: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  low: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
};

const stockState = (item) =>
  item.availableStock < 0 ? "backorder"
    : item.availableStock === 0 ? "out"
      : item.availableStock <= (item.lowStockThreshold ?? 5) ? "low"
        : "ok";

const AdminStarterKits = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [restockFor, setRestockFor] = useState(null);
  const [restockValue, setRestockValue] = useState("");

  useScrollLock(showModal || !!restockFor);

  useEffect(() => { setTitle("Starter Kits"); }, [setTitle]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        API.get("/admin/starter-kit-items"),
        API.get("/admin/categories").catch(() => ({ data: [] })),
      ]);
      setItems(itemsRes.data || []);
      setCategories(catsRes.data || []);
    } catch {
      toast({ title: "Could not load starter kits", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: catFilter || categories[0]?._id || "" });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      categoryId: item.categoryId?._id || item.categoryId || "",
      description: item.description || "",
      availableStock: item.availableStock ?? 0,
      kitQuantity: item.kitQuantity ?? 1,
      price: item.price ?? 0,
      isMandatory: !!item.isMandatory,
      isActive: item.isActive !== false,
      lowStockThreshold: item.lowStockThreshold ?? 5,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Item name is required", variant: "destructive" });
    if (!form.categoryId) return toast({ title: "Select a category", variant: "destructive" });
    if (Number(form.price) < 0) return toast({ title: "Price cannot be negative", variant: "destructive" });
    if (Number(form.kitQuantity) < 1) return toast({ title: "Kit quantity must be at least 1", variant: "destructive" });

    setSaving(true);
    try {
      if (editing) {
        await API.put(`/admin/starter-kit-items/${editing._id}`, form);
        toast({ title: "Item updated" });
      } else {
        await API.post("/admin/starter-kit-items", form);
        toast({ title: "Item created" });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast({ title: "Save failed", description: err.response?.data?.message || "Could not save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Remove "${item.name}"? Deactivating is usually safer.`)) return;
    try {
      await API.delete(`/admin/starter-kit-items/${item._id}`);
      toast({ title: "Item removed" });
      fetchAll();
    } catch (err) {
      toast({ title: "Could not remove", description: err.response?.data?.message || "Delete failed.", variant: "destructive" });
    }
  };

  const submitRestock = async (e) => {
    e.preventDefault();
    const delta = Number(restockValue);
    if (!Number.isFinite(delta) || delta === 0) {
      return toast({ title: "Enter a non-zero quantity", variant: "destructive" });
    }
    try {
      await API.patch(`/admin/starter-kit-items/${restockFor._id}/stock`, { delta, reason: "Admin restock" });
      toast({ title: `Stock updated by ${delta > 0 ? "+" : ""}${delta}` });
      setRestockFor(null);
      setRestockValue("");
      fetchAll();
    } catch (err) {
      toast({ title: "Could not update stock", description: err.response?.data?.message, variant: "destructive" });
    }
  };

  const filtered = items.filter((i) => {
    if (catFilter && (i.categoryId?._id || i.categoryId) !== catFilter) return false;
    if (!search) return true;
    return i.name?.toLowerCase().includes(search.toLowerCase());
  });

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500";
  const labelCls = "block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
          <Package className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">No starter kit items yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const st = stockState(item);
            return (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">{item.name}</h3>
                      {item.isMandatory && (
                        <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">Mandatory</span>
                      )}
                      {!item.isActive && (
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Inactive</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{item.categoryId?.name || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">Edit</button>
                    <button onClick={() => handleDelete(item)} className="p-1.5 text-slate-400 hover:text-red-500" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Stock</p>
                    <p className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-sm font-black tabular-nums ${stateStyle[st]}`}>{item.availableStock}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Per Kit</p>
                    <p className="mt-0.5 text-sm font-black tabular-nums text-slate-700 dark:text-slate-300">x{item.kitQuantity}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Price</p>
                    <p className="mt-0.5 text-sm font-black tabular-nums text-slate-700 dark:text-slate-300">₹{item.price}</p>
                  </div>
                </div>

                {st === "backorder" && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Backorder — more sold than in stock
                  </p>
                )}

                <button
                  onClick={() => { setRestockFor(item); setRestockValue(""); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600"
                >
                  <Boxes className="h-3.5 w-3.5" /> Adjust Stock
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
            <motion.form initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} onSubmit={handleSave}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? "Edit Item" : "New Starter Kit Item"}</h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div>
                <label className={labelCls}>Item Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. T-Shirt" required />
              </div>

              <div>
                <label className={labelCls}>Category *</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputCls} required>
                  <option value="">— Select a category —</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Available Stock</label>
                  <input type="number" value={form.availableStock} onChange={(e) => setForm({ ...form, availableStock: Number(e.target.value) })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Quantity Per Kit *</label>
                  <input type="number" min="1" value={form.kitQuantity} onChange={(e) => setForm({ ...form, kitQuantity: Number(e.target.value) })} className={inputCls} required />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-2">
                Quantity per kit is fixed here and inherited by every combo pack that includes this item.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price (₹) *</label>
                  <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Low Stock Alert At</label>
                  <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isMandatory} onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mandatory item</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active — visible to Sewaks</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editing ? "Save Changes" : "Create Item"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restock modal */}
      <AnimatePresence>
        {restockFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRestockFor(null)}>
            <motion.form initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} onSubmit={submitRestock}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5"><PackageCheck className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Adjust Stock</h2>
                  <p className="text-xs text-slate-500">{restockFor.name} — currently {restockFor.availableStock}</p>
                </div>
              </div>
              <input
                type="number"
                value={restockValue}
                onChange={(e) => setRestockValue(e.target.value)}
                className={inputCls}
                placeholder="e.g. 50 to add, -5 to remove"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">Positive adds stock, negative removes it.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRestockFor(null)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Apply</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminStarterKits;
