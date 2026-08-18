import { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Plus, X, Save, Trash2, Loader2, Building2,
  Phone, Layers, Search
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";
import AvailabilityEditor from "@/modules/admin/components/AvailabilityEditor";

const emptyForm = {
  name: "",
  mobile: "",
  trainingCenter: "",
  categories: [],
  capacity: 5,
  availability: [
    { day: "mon", startTime: "10:00", endTime: "18:00" },
    { day: "tue", startTime: "10:00", endTime: "18:00" },
    { day: "wed", startTime: "10:00", endTime: "18:00" },
    { day: "thu", startTime: "10:00", endTime: "18:00" },
    { day: "fri", startTime: "10:00", endTime: "18:00" },
  ],
  isActive: true,
};

const AdminTrainers = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [trainers, setTrainers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [centerFilter, setCenterFilter] = useState("");

  useScrollLock(showModal);

  useEffect(() => {
    setTitle("Trainers");
    fetchAll();
  }, [setTitle]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [trainersRes, centersRes] = await Promise.all([
        API.get("/admin/trainers"),
        API.get("/admin/training-centers"),
      ]);
      setTrainers(trainersRes.data || []);
      setCenters(centersRes.data || []);
    } catch {
      toast({ title: "Could not load trainers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // A trainer can only teach what their center offers — the picker enforces it.
  const availableCategories = useMemo(() => {
    const center = centers.find((c) => c._id === form.trainingCenter);
    return center?.categories || [];
  }, [centers, form.trainingCenter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, trainingCenter: centers[0]?._id || "" });
    setShowModal(true);
  };

  const openEdit = (trainer) => {
    setEditing(trainer);
    setForm({
      name: trainer.name || "",
      mobile: trainer.mobile || "",
      trainingCenter: trainer.trainingCenter?._id || trainer.trainingCenter || "",
      categories: (trainer.categories || []).map((c) => c._id || c),
      capacity: trainer.capacity ?? 5,
      availability: trainer.availability || [],
      isActive: trainer.isActive !== false,
    });
    setShowModal(true);
  };

  const handleCenterChange = (centerId) => {
    const center = centers.find((c) => c._id === centerId);
    const allowed = (center?.categories || []).map((c) => c._id || c);
    // Drop any category the new center doesn't teach.
    setForm((f) => ({
      ...f,
      trainingCenter: centerId,
      categories: f.categories.filter((c) => allowed.includes(c)),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Trainer name is required", variant: "destructive" });
    if (!/^\d{10}$/.test(form.mobile)) return toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
    if (!form.trainingCenter) return toast({ title: "Select a training center", variant: "destructive" });
    if (!form.categories.length) return toast({ title: "Select at least one skill", variant: "destructive" });

    setSaving(true);
    try {
      if (editing) {
        await API.put(`/admin/trainers/${editing._id}`, form);
        toast({ title: "Trainer updated" });
      } else {
        await API.post("/admin/trainers", form);
        toast({ title: "Trainer created" });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err.response?.data?.message || "Could not save the trainer.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (trainer) => {
    if (!window.confirm(`Remove "${trainer.name}"? Deactivating is usually safer.`)) return;
    try {
      await API.delete(`/admin/trainers/${trainer._id}`);
      setTrainers((prev) => prev.filter((t) => t._id !== trainer._id));
      toast({ title: "Trainer removed" });
    } catch (err) {
      toast({
        title: "Could not remove",
        description: err.response?.data?.message || "Delete failed.",
        variant: "destructive",
      });
    }
  };

  const filtered = trainers.filter((t) => {
    if (centerFilter && (t.trainingCenter?._id || t.trainingCenter) !== centerFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.mobile?.includes(q);
  });

  const inputCls =
    "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors";
  const labelCls =
    "block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or mobile..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={centerFilter}
          onChange={(e) => setCenterFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
        >
          <option value="">All centers</option>
          {centers.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={openCreate}
          disabled={centers.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Trainer
        </button>
      </div>

      {centers.length === 0 && !loading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400">
          Create a training center first — every trainer must belong to one.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
          <GraduationCap className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">No trainers yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((trainer) => (
            <motion.div
              key={trainer._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{trainer.name}</h3>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        trainer.isActive
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {trainer.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Building2 className="h-3 w-3" /> {trainer.trainingCenter?.name || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(trainer)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(trainer)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                    aria-label="Remove trainer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(trainer.categories || []).map((cat) => (
                  <span
                    key={cat._id || cat}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                  >
                    <Layers className="h-2.5 w-2.5" /> {cat.name || "Skill"}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {trainer.mobile}
                </span>
                <span>{trainer.capacity} seats/slot</span>
                <span>{(trainer.availability || []).length} day windows</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSave}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editing ? "Edit Trainer" : "New Trainer"}
                </h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Trainer Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                    placeholder="e.g. Ramesh Kumar"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Mobile Number *</label>
                  <input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "") })}
                    maxLength={10}
                    className={inputCls}
                    placeholder="10-digit number"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Training Center *</label>
                <select
                  value={form.trainingCenter}
                  onChange={(e) => handleCenterChange(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">— Select a center —</option>
                  {centers.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Skills / Categories *</label>
                {!form.trainingCenter ? (
                  <p className="text-xs text-slate-400 italic">Select a training center first.</p>
                ) : availableCategories.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    That center has no categories assigned. Add them on the center first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableCategories.map((c) => {
                      const id = c._id || c;
                      const on = form.categories.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              categories: on
                                ? form.categories.filter((x) => x !== id)
                                : [...form.categories, id],
                            })
                          }
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                            on
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {c.name || "Category"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Capacity (seats per slot)</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>

              <AvailabilityEditor
                value={form.availability}
                onChange={(availability) => setForm({ ...form, availability })}
                label="Trainer Available Time"
              />
              <p className="text-[11px] text-slate-400">
                Sessions are only offered where these hours overlap the center's opening hours.
              </p>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Active — available for session allocation
                </span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editing ? "Save Changes" : "Create Trainer"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTrainers;
