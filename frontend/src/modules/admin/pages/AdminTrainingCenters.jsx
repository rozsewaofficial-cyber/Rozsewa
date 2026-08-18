import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, X, Save, Trash2, Loader2, MapPin, Users,
  Phone, Layers, CheckCircle2, Search
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";
import AvailabilityEditor from "@/modules/admin/components/AvailabilityEditor";

const emptyForm = {
  name: "",
  cities: [],
  address: "",
  contactNumber: "",
  categories: [],
  capacity: 20,
  availability: [
    { day: "mon", startTime: "10:00", endTime: "18:00" },
    { day: "tue", startTime: "10:00", endTime: "18:00" },
    { day: "wed", startTime: "10:00", endTime: "18:00" },
    { day: "thu", startTime: "10:00", endTime: "18:00" },
    { day: "fri", startTime: "10:00", endTime: "18:00" },
  ],
  isActive: true,
};

const AdminTrainingCenters = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [centers, setCenters] = useState([]);
  const [zones, setZones] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  useScrollLock(showModal);

  useEffect(() => {
    setTitle("Training Centers");
    fetchAll();
  }, [setTitle]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [centersRes, zonesRes, catsRes] = await Promise.all([
        API.get("/admin/training-centers"),
        API.get("/admin/zones").catch(() => ({ data: [] })),
        API.get("/admin/categories").catch(() => ({ data: [] })),
      ]);
      setCenters(centersRes.data || []);
      setZones(zonesRes.data || []);
      setCategories(catsRes.data || []);
    } catch {
      toast({ title: "Could not load training centers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (center) => {
    setEditing(center);
    setForm({
      name: center.name || "",
      cities: center.cities || [],
      address: center.address || "",
      contactNumber: center.contactNumber || "",
      categories: (center.categories || []).map((c) => c._id || c),
      capacity: center.capacity ?? 20,
      availability: center.availability || [],
      isActive: center.isActive !== false,
    });
    setShowModal(true);
  };

  const toggleIn = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Center name is required", variant: "destructive" });
    if (!form.cities.length) return toast({ title: "Select at least one city", variant: "destructive" });
    if (!form.categories.length) return toast({ title: "Select at least one skill category", variant: "destructive" });

    setSaving(true);
    try {
      if (editing) {
        const { data } = await API.put(`/admin/training-centers/${editing._id}`, form);
        setCenters((prev) => prev.map((c) => (c._id === data._id ? { ...c, ...data } : c)));
        toast({ title: "Center updated" });
      } else {
        await API.post("/admin/training-centers", form);
        toast({ title: "Center created" });
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast({
        title: "Save failed",
        description: err.response?.data?.message || "Could not save the center.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (center) => {
    if (!window.confirm(`Remove "${center.name}"? Deactivating is usually safer.`)) return;
    try {
      await API.delete(`/admin/training-centers/${center._id}`);
      setCenters((prev) => prev.filter((c) => c._id !== center._id));
      toast({ title: "Center removed" });
    } catch (err) {
      toast({
        title: "Could not remove",
        description: err.response?.data?.message || "Delete failed.",
        variant: "destructive",
      });
    }
  };

  const filtered = centers.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.cities || []).some((city) => city.toLowerCase().includes(search.toLowerCase()))
  );

  const inputCls =
    "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 transition-colors";
  const labelCls =
    "block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by center or city..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Center
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
          <Building2 className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">No training centers yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Sessions cannot be scheduled until at least one center exists.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((center) => (
            <motion.div
              key={center._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{center.name}</h3>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        center.isActive
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {center.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {center.address && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{center.address}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(center)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(center)}
                    className="p-1.5 text-slate-400 hover:text-red-500"
                    aria-label="Remove center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(center.cities || []).map((city) => (
                  <span
                    key={city}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
                  >
                    <MapPin className="h-2.5 w-2.5" /> {city}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(center.categories || []).map((cat) => (
                  <span
                    key={cat._id || cat}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                  >
                    <Layers className="h-2.5 w-2.5" /> {cat.name || "Category"}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {center.trainerCount || 0} trainer
                  {center.trainerCount === 1 ? "" : "s"}
                </span>
                <span>{center.capacity} seats/day</span>
                {center.contactNumber && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {center.contactNumber}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
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
                  {editing ? "Edit Training Center" : "New Training Center"}
                </h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div>
                <label className={labelCls}>Center Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Varanasi Skill Hub"
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Cities / Areas Served *</label>
                {zones.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    No zones configured. Add cities under Zones &amp; Cities first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {zones.map((z) => {
                      const on = form.cities.includes(z.name);
                      return (
                        <button
                          key={z._id}
                          type="button"
                          onClick={() => setForm({ ...form, cities: toggleIn(form.cities, z.name) })}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                            on
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {z.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Skills / Categories Taught *</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {categories.map((c) => {
                    const on = form.categories.includes(c._id);
                    return (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => setForm({ ...form, categories: toggleIn(form.categories, c._id) })}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                          on
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputCls}
                  rows={2}
                  placeholder="Shown to the Sewak for offline sessions"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Contact Number</label>
                  <input
                    value={form.contactNumber}
                    onChange={(e) => setForm({ ...form, contactNumber: e.target.value.replace(/\D/g, "") })}
                    maxLength={10}
                    className={inputCls}
                    placeholder="10-digit number"
                  />
                </div>
                <div>
                  <label className={labelCls}>Capacity (seats per day)</label>
                  <input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              </div>

              <AvailabilityEditor
                value={form.availability}
                onChange={(availability) => setForm({ ...form, availability })}
                label="Center Opening Hours"
              />

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
                  {editing ? "Save Changes" : "Create Center"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminTrainingCenters;
