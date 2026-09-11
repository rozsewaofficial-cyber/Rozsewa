import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Gift,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  X,
  Upload,
  Search,
  Coins,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import API from "@/lib/api";

/**
 * Admin "🎁 Offer Management".
 *
 * Deliberately a NEW page rather than a rewrite of AdminOffers.jsx: that one is
 * the (mock) provider offer-approval queue, a different concept with a
 * different backend. Two screens, two jobs.
 *
 * Original Price (MRP) and Discount % are both read-only here — MRP mirrors the
 * catalog price and the percentage is computed from it, so the strikethrough
 * price on a customer's card is always a price the item genuinely carries.
 */

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  expired: "bg-gray-100 text-gray-600 border-gray-200",
  inactive: "bg-amber-100 text-amber-700 border-amber-200",
};

const emptyForm = {
  targetKey: "",
  offerPrice: "",
  startDate: "",
  endDate: "",
  image: "",
  isActive: true,
  allowCoins: false,
};

/** Local mirror of the server's ((MRP - offer) / MRP) * 100. */
const previewPercent = (original, offer) => {
  const o = Number(original) || 0;
  const p = Number(offer) || 0;
  if (o <= 0 || p < 0 || p >= o) return 0;
  return Math.max(0, Math.min(100, Math.round(((o - p) / o) * 100)));
};

const AdminOfferManagement = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [offers, setOffers] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTitle("Offer Management");
  }, [setTitle]);

  const load = useCallback(async () => {
    try {
      const [o, t] = await Promise.all([
        API.get("/admin/offers?limit=100"),
        API.get("/admin/offers/targets"),
      ]);
      setOffers(o.data.offers || []);
      setTargets(t.data.targets || []);
    } catch (err) {
      toast({
        title: "Failed to load offers",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Targets are keyed by a composite string because the two catalogs are
  // addressed differently (a Service id vs a category + sub-service id pair).
  const targetKeyOf = (t) =>
    t.targetType === "service"
      ? `service:${t.serviceId}`
      : `category_service:${t.categoryId}:${t.subServiceId}`;

  const selectedTarget = targets.find((t) => targetKeyOf(t) === form.targetKey);
  const mrp = selectedTarget?.originalPrice || 0;
  const pct = previewPercent(mrp, form.offerPrice);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (offer) => {
    setEditingId(offer._id);
    setForm({
      targetKey:
        offer.targetType === "service"
          ? `service:${offer.serviceId}`
          : `category_service:${offer.categoryId}:${offer.subServiceId}`,
      offerPrice: String(offer.offerPrice),
      startDate: new Date(offer.startDate).toISOString().slice(0, 16),
      endDate: new Date(offer.endDate).toISOString().slice(0, 16),
      image: offer.image || "",
      isActive: offer.isActive,
      allowCoins: offer.allowCoins,
    });
    setShowModal(true);
  };

  const handleImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.append("image", file);
      const res = await API.post("/upload", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, image: res.data.url }));
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTarget) {
      toast({ title: "Select a service first", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // MRP and discount % are intentionally NOT sent — the server derives both
      // from the catalog so they cannot disagree with the real price.
      const payload = {
        targetType: selectedTarget.targetType,
        serviceId: selectedTarget.serviceId || null,
        categoryId: selectedTarget.categoryId || null,
        subServiceId: selectedTarget.subServiceId || null,
        offerPrice: Number(form.offerPrice),
        startDate: form.startDate,
        endDate: form.endDate,
        image: form.image || null,
        isActive: form.isActive,
        allowCoins: form.allowCoins,
      };

      if (editingId) {
        await API.put(`/admin/offers/${editingId}`, payload);
        toast({ title: "Offer updated" });
      } else {
        await API.post("/admin/offers", payload);
        toast({ title: "Offer created" });
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast({
        title: editingId ? "Update failed" : "Create failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (offer) => {
    try {
      await API.patch(`/admin/offers/${offer._id}/status`, {
        isActive: !offer.isActive,
      });
      load();
    } catch (err) {
      toast({
        title: "Failed to change status",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (offer) => {
    const ok = await confirm(
      `Remove the offer on "${offer.serviceName}"? Past bookings keep the price they were charged.`,
      { title: "Delete Offer", confirmLabel: "Delete", destructive: true },
    );
    if (!ok) return;
    try {
      await API.delete(`/admin/offers/${offer._id}`);
      toast({ title: "Offer removed" });
      load();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    }
  };

  const visible = offers.filter((o) =>
    search
      ? o.serviceName.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-foreground">
            <Gift className="h-6 w-6 text-rose-500" />
            Offer Management
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Put a catalog service on a discounted price. The platform funds the
            discount — partners are still paid on the full catalog value.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service"
              className="h-11 w-56 rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={openCreate}
            className="flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Create Offer
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-bold">Service</th>
                <th className="px-6 py-4 font-bold">MRP</th>
                <th className="px-6 py-4 font-bold">Offer price</th>
                <th className="px-6 py-4 font-bold">% OFF</th>
                <th className="px-6 py-4 font-bold">Validity</th>
                <th className="px-6 py-4 font-bold">Coins</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-14 text-center text-sm font-semibold text-muted-foreground"
                  >
                    No offers yet. Create one to see it in the customer app.
                  </td>
                </tr>
              ) : (
                visible.map((offer) => (
                  <tr key={offer._id} className="transition hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground">
                        {offer.serviceName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {offer.categoryName}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-bold text-muted-foreground line-through">
                      ₹{offer.originalPrice}
                    </td>
                    <td className="px-6 py-4 font-black text-foreground">
                      ₹{offer.offerPrice}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-black uppercase text-rose-600 dark:bg-rose-950/30">
                        {offer.discountPercent}% OFF
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                      {new Date(offer.startDate).toLocaleDateString("en-IN")} →{" "}
                      {new Date(offer.endDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4">
                      {offer.allowCoins ? (
                        <span className="flex items-center gap-1 text-[11px] font-black uppercase text-amber-600">
                          <Coins className="h-3.5 w-3.5" /> Allowed
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold uppercase text-muted-foreground">
                          Blocked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(offer)}
                        title="Toggle Active / Inactive"
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[offer.status] || STATUS_STYLES.inactive}`}
                      >
                        {offer.status}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(offer)}
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-600 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(offer)}
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / edit */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-lg font-black tracking-tight text-foreground">
                {editingId ? "Edit Offer" : "Create Offer"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Service / Product *
                </span>
                <select
                  value={form.targetKey}
                  onChange={(e) =>
                    setForm({ ...form, targetKey: e.target.value })
                  }
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                >
                  <option value="">Select a service…</option>
                  {targets.map((t) => (
                    <option key={targetKeyOf(t)} value={targetKeyOf(t)}>
                      {t.label} — ₹{t.originalPrice} ({t.catalog}
                      {t.categoryName ? ` · ${t.categoryName}` : ""})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    MRP
                  </span>
                  <input
                    readOnly
                    value={mrp ? `₹${mrp}` : "—"}
                    title="Read-only: mirrors the service's catalog price"
                    className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 text-sm font-bold text-muted-foreground outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Offer price *
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.offerPrice}
                    onChange={(e) =>
                      setForm({ ...form, offerPrice: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    % OFF
                  </span>
                  <input
                    readOnly
                    value={`${pct}%`}
                    title="Auto-calculated by the system"
                    className="mt-1.5 h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 text-sm font-black text-rose-600 outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    Start *
                  </span>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    End *
                  </span>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Offer image / banner
                </span>
                <div className="mt-1.5 flex items-center gap-3">
                  <label className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground hover:bg-muted">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {form.image ? "Replace image" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImage(e.target.files?.[0])}
                    />
                  </label>
                  {form.image && (
                    <img
                      src={form.image}
                      alt="Offer"
                      className="h-11 w-16 rounded-lg object-cover"
                    />
                  )}
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`h-11 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                    form.isActive
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {form.isActive ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, allowCoins: !form.allowCoins })
                  }
                  title="Allow Offer + Coins Together"
                  className={`h-11 rounded-xl text-[11px] font-black uppercase tracking-wider transition ${
                    form.allowCoins
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Coins {form.allowCoins ? "allowed" : "blocked"}
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !form.targetKey}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Save changes" : "Create offer"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminOfferManagement;
