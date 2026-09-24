import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Loader2, X, Save, AlertTriangle, Truck, PackageCheck,
  CheckCircle2, XCircle, ListFilter, BarChart3, Boxes, IndianRupee
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  confirmed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  dispatched: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  delivered: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const STATE_STYLES = {
  backorder: "text-red-600", out: "text-orange-600", low: "text-amber-600", ok: "text-emerald-600",
};

const AdminKitOrders = () => {
  const { setTitle } = useOutletContext();
  const { toast } = useToast();

  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  // Pending orders across the whole queue, which one page cannot report.
  const [pendingCount, setPendingCount] = useState(0);
  const [inventory, setInventory] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [dues, setDues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmFor, setConfirmFor] = useState(null);
  const [deliveryDays, setDeliveryDays] = useState("5");
  const [saving, setSaving] = useState(false);

  // Shared across Orders and the Inventory ledger: which categories and
  // cities exist, which a page of rows on screen cannot know.
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);

  // Orders filters
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");

  // Inventory filters
  const [invCategoryFilter, setInvCategoryFilter] = useState("");
  const [invStateFilter, setInvStateFilter] = useState("");

  // Stock ledger filters
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");

  useScrollLock(!!confirmFor);

  useEffect(() => { setTitle("Kit Orders & Inventory"); }, [setTitle]);

  useEffect(() => {
    API.get("/admin/categories").then(({ data }) => setCategories(data || [])).catch(() => {});
    API.get("/admin/providers/stats").then(({ data }) => setCities(data?.cities || [])).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
        ...(cityFilter ? { city: cityFilter } : {}),
        ...(orderDateFrom ? { dateFrom: orderDateFrom } : {}),
        ...(orderDateTo ? { dateTo: orderDateTo } : {}),
      };
      const res = await API.get("/admin/kit-orders", { params });
      setOrders(res.data || []);
      // How many orders are still pending, across all of them rather than
      // across the page on screen.
      setPendingCount(Number(res.headers?.["x-pending-count"]) || 0);
    } catch {
      toast({ title: "Could not load orders", variant: "destructive" });
    } finally { setLoading(false); }
  }, [statusFilter, categoryFilter, cityFilter, orderDateFrom, orderDateTo, toast]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...(invCategoryFilter ? { categoryId: invCategoryFilter } : {}),
        ...(invStateFilter ? { state: invStateFilter } : {}),
      };
      const { data } = await API.get("/admin/kit-inventory/summary", { params });
      setInventory(data);
    } catch {
      toast({ title: "Could not load inventory", variant: "destructive" });
    } finally { setLoading(false); }
  }, [invCategoryFilter, invStateFilter, toast]);

  const fetchLedger = useCallback(async () => {
    try {
      const params = {
        ...(ledgerCategoryFilter ? { categoryId: ledgerCategoryFilter } : {}),
        ...(ledgerDateFrom ? { dateFrom: ledgerDateFrom } : {}),
        ...(ledgerDateTo ? { dateTo: ledgerDateTo } : {}),
        limit: 100,
      };
      const { data } = await API.get("/admin/kit-inventory/ledger", { params });
      setLedger(data || []);
    } catch {
      toast({ title: "Could not load stock entries", variant: "destructive" });
    }
  }, [ledgerCategoryFilter, ledgerDateFrom, ledgerDateTo, toast]);

  const fetchDues = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/admin/kit-dues");
      setDues(data);
    } catch {
      toast({ title: "Could not load dues", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (tab === "orders") fetchOrders();
    else if (tab === "inventory") { fetchInventory(); fetchLedger(); }
    else fetchDues();
  }, [tab, fetchOrders, fetchInventory, fetchLedger, fetchDues]);

  const submitConfirm = async (e) => {
    e.preventDefault();
    const days = Number(deliveryDays);
    if (!Number.isFinite(days) || days < 0) {
      return toast({ title: "Enter valid delivery days", variant: "destructive" });
    }
    setSaving(true);
    try {
      await API.put(`/admin/kit-orders/${confirmFor._id}/confirm`, { expectedDeliveryDays: days });
      toast({ title: "Order confirmed", description: "Stock has been deducted." });
      setConfirmFor(null);
      fetchOrders();
    } catch (err) {
      toast({ title: "Could not confirm", description: err.response?.data?.message || "Failed.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const changeStatus = async (order, status) => {
    setBusyId(order._id);
    try {
      await API.put(`/admin/kit-orders/${order._id}/status`, { status });
      toast({ title: `Marked ${status}` });
      fetchOrders();
    } catch (err) {
      toast({ title: "Could not update", description: err.response?.data?.message || "Failed.", variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const cancelOrder = async (order) => {
    if (!window.confirm(`Cancel this order? Stock will be restored${order.downPaymentAmount > 0 ? ` and ₹${order.downPaymentAmount} refunded to the Sewak's wallet` : ""}.`)) return;
    setBusyId(order._id);
    try {
      await API.put(`/admin/kit-orders/${order._id}/cancel`, { reason: "Cancelled by admin" });
      toast({ title: "Order cancelled" });
      fetchOrders();
    } catch (err) {
      toast({ title: "Could not cancel", description: err.response?.data?.message || "Failed.", variant: "destructive" });
    } finally { setBusyId(null); }
  };


  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500";

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "orders", label: "Orders", icon: ListFilter },
          { id: "inventory", label: "Inventory", icon: Boxes },
          { id: "dues", label: "EMI Dues", icon: BarChart3 },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-emerald-600 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <div className="flex flex-wrap gap-2 items-center">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
            <option value="">All statuses</option>
            {["pending", "confirmed", "dispatched", "delivered", "cancelled"].map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c._id} value={c._id}>{c.name}</option>))}
          </select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
            <option value="">All cities</option>
            {cities.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <div className="flex items-center gap-1.5">
            <input type="date" value={orderDateFrom} onChange={(e) => setOrderDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
            <span className="text-xs font-bold text-slate-400">to</span>
            <input type="date" value={orderDateTo} onChange={(e) => setOrderDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
          </div>
          {(categoryFilter || cityFilter || orderDateFrom || orderDateTo) && (
            <button onClick={() => { setCategoryFilter(""); setCityFilter(""); setOrderDateFrom(""); setOrderDateTo(""); }}
              className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
              Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
      ) : tab === "inventory" ? (
        <InventoryView
          inventory={inventory}
          invCategoryFilter={invCategoryFilter} setInvCategoryFilter={setInvCategoryFilter}
          invStateFilter={invStateFilter} setInvStateFilter={setInvStateFilter}
          ledger={ledger}
          ledgerCategoryFilter={ledgerCategoryFilter} setLedgerCategoryFilter={setLedgerCategoryFilter}
          ledgerDateFrom={ledgerDateFrom} setLedgerDateFrom={setLedgerDateFrom}
          ledgerDateTo={ledgerDateTo} setLedgerDateTo={setLedgerDateTo}
        />
      ) : tab === "dues" ? (
        <DuesView dues={dues} />
      ) : (
        <>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {pendingCount} order{pendingCount === 1 ? "" : "s"} awaiting confirmation. Stock is deducted only when you confirm.
              </p>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-20 text-center">
              <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">No orders match these filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[o.status]}`}>{o.status}</span>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {o.orderType === "combo" ? "Combo" : "Single"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${o.paymentMode === "part" ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                          {o.paymentMode === "part" ? "Part Payment" : "Full Payment"}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {o.orderType === "combo" ? o.comboName : o.lines?.[0]?.itemName} × {o.orderQuantity}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {o.sewakId?.ownerName || "Sewak"}
                        {o.sewakId?.vendorCode ? ` · ${o.sewakId.vendorCode}` : ""}
                        {o.sewakId?.mobile ? ` · ${o.sewakId.mobile}` : ""}
                        {o.sewakId?.city ? ` · ${o.sewakId.city}` : ""}
                      </p>

                      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 space-y-1">
                        {(o.lines || []).map((l, i) => (
                          <div key={i} className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">{l.itemName}</span>
                            <span className="font-black tabular-nums text-slate-500">×{l.kitQuantity * o.orderQuantity}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        ₹{o.totalAmount}
                        {o.paymentMode === "part" && (
                          <span className="font-medium text-slate-500"> — paid ₹{o.downPaymentAmount}, due ₹{o.remainingAmount}</span>
                        )}
                      </p>

                      {o.expectedDeliveryDate && (
                        <p className="text-[11px] text-slate-500">
                          Expected delivery: {new Date(o.expectedDeliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}

                      {o.stockWarnings?.length > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-red-600">
                            <AlertTriangle className="h-3 w-3" /> Insufficient stock
                          </p>
                          {o.stockWarnings.map((w, i) => (
                            <p key={i} className="text-[11px] font-semibold text-red-600">
                              {w.itemName}: need {w.need}, have {w.have}
                            </p>
                          ))}
                          <p className="mt-1 text-[10px] text-red-500">Confirming will drive stock negative (backorder).</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {o.status === "pending" && (
                        <>
                          <button onClick={() => { setConfirmFor(o); setDeliveryDays("5"); }}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                          </button>
                          <button disabled={busyId === o._id} onClick={() => cancelOrder(o)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50">
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </>
                      )}
                      {o.status === "confirmed" && (
                        <>
                          <button disabled={busyId === o._id} onClick={() => changeStatus(o, "dispatched")}
                            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
                            <Truck className="h-3.5 w-3.5" /> Dispatch
                          </button>
                          <button disabled={busyId === o._id} onClick={() => cancelOrder(o)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50">
                            <XCircle className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </>
                      )}
                      {o.status === "dispatched" && (
                        <button disabled={busyId === o._id} onClick={() => changeStatus(o, "delivered")}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          <PackageCheck className="h-3.5 w-3.5" /> Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmFor(null)}>
            <motion.form initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} onSubmit={submitConfirm}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Order</h2>
                <button type="button" onClick={() => setConfirmFor(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
                {(confirmFor.lines || []).map((l, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{l.itemName}</span>
                    <span className="font-black tabular-nums text-red-600">−{l.kitQuantity * confirmFor.orderQuantity}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">This will deduct the above from central stock and cannot be undone except by cancelling the order.</p>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Expected Delivery (days) *</label>
                <input type="number" min="0" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} className={inputCls} required autoFocus />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmFor(null)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Confirm
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Tile = ({ label, value, accent, active, onClick }) => (
  <div
    onClick={onClick}
    className={`rounded-2xl border p-4 ${onClick ? "cursor-pointer" : ""} ${active ? "border-emerald-500 ring-1 ring-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}
  >
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-1 text-2xl font-black tabular-nums ${accent || "text-slate-900 dark:text-white"}`}>{value}</p>
  </div>
);

const InventoryView = ({
  inventory, invCategoryFilter, setInvCategoryFilter, invStateFilter, setInvStateFilter,
  ledger, ledgerCategoryFilter, setLedgerCategoryFilter, ledgerDateFrom, setLedgerDateFrom, ledgerDateTo, setLedgerDateTo
}) => {
  if (!inventory) return null;
  const t = inventory.totals;
  const toggleState = (s) => setInvStateFilter(invStateFilter === s ? "" : s);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile label="Items" value={t.items} />
        <Tile label="Backorder" value={t.backorder} accent="text-red-600" active={invStateFilter === "backorder"} onClick={() => toggleState("backorder")} />
        <Tile label="Out of Stock" value={t.out} accent="text-orange-600" active={invStateFilter === "out"} onClick={() => toggleState("out")} />
        <Tile label="Low Stock" value={t.low} accent="text-amber-600" active={invStateFilter === "low"} onClick={() => toggleState("low")} />
        <Tile label="Healthy" value={t.ok} accent="text-emerald-600" active={invStateFilter === "ok"} onClick={() => toggleState("ok")} />
        <Tile label="Stock Value" value={`₹${t.stockValue}`} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={invCategoryFilter} onChange={(e) => setInvCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
          <option value="">All categories</option>
          {(inventory.categories || []).map((c) => (<option key={c._id} value={c._id}>{c.name}</option>))}
        </select>
        {(invCategoryFilter || invStateFilter) && (
          <button onClick={() => { setInvCategoryFilter(""); setInvStateFilter(""); }}
            className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
            Clear
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="pb-2 text-left">Item</th>
              <th className="pb-2 text-left">Category</th>
              <th className="pb-2 text-right">Stock</th>
              <th className="pb-2 text-right">Per Kit</th>
              <th className="pb-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {inventory.rows.length === 0 ? (
              <tr><td colSpan="5" className="py-8 text-center text-sm font-semibold text-slate-400">No items match these filters</td></tr>
            ) : inventory.rows.map((r) => (
              <tr key={r._id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2 font-semibold text-slate-700 dark:text-slate-300">{r.name}</td>
                <td className="py-2 text-slate-500">{r.category}</td>
                <td className={`py-2 text-right font-black tabular-nums ${STATE_STYLES[r.state]}`}>{r.availableStock}</td>
                <td className="py-2 text-right tabular-nums text-slate-500">×{r.kitQuantity}</td>
                <td className="py-2 text-right tabular-nums text-slate-500">₹{r.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock entry log — every manual restock/correction, date-wise */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
          <Boxes className="h-4 w-4 text-emerald-600" /> Stock Entry Log
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={ledgerCategoryFilter} onChange={(e) => setLedgerCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500">
            <option value="">All categories</option>
            {(inventory.categories || []).map((c) => (<option key={c._id} value={c._id}>{c.name}</option>))}
          </select>
          <div className="flex items-center gap-1.5">
            <input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
            <span className="text-xs font-bold text-slate-400">to</span>
            <input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500" />
          </div>
          {(ledgerCategoryFilter || ledgerDateFrom || ledgerDateTo) && (
            <button onClick={() => { setLedgerCategoryFilter(""); setLedgerDateFrom(""); setLedgerDateTo(""); }}
              className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700">
              Clear
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="pb-2 text-left">Date</th>
                <th className="pb-2 text-left">Item</th>
                <th className="pb-2 text-left">Category</th>
                <th className="pb-2 text-right">Change</th>
                <th className="pb-2 text-right">New Stock</th>
                <th className="pb-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan="6" className="py-8 text-center text-sm font-semibold text-slate-400">No stock entries match these filters</td></tr>
              ) : ledger.map((e) => (
                <tr key={e._id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 text-slate-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="py-2 font-semibold text-slate-700 dark:text-slate-300">{e.itemName}</td>
                  <td className="py-2 text-slate-500">{e.category}</td>
                  <td className={`py-2 text-right font-black tabular-nums ${e.delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {e.delta >= 0 ? "+" : ""}{e.delta}
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-500">{e.newStock}</td>
                  <td className="py-2 text-slate-500">{e.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DuesView = ({ dues }) => {
  if (!dues) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Tile label="Active" value={dues.totals.active} accent="text-amber-600" />
        <Tile label="Cleared" value={dues.totals.cleared} accent="text-emerald-600" />
        <Tile label="Outstanding" value={`₹${dues.totals.outstanding}`} accent="text-red-600" />
      </div>

      {dues.dues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-16 text-center">
          <IndianRupee className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">No EMI schedules yet</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="pb-2 text-left">Sewak</th>
                <th className="pb-2 text-left">Status</th>
                <th className="pb-2 text-left">Freq</th>
                <th className="pb-2 text-right">Instalment</th>
                <th className="pb-2 text-right">Paid</th>
                <th className="pb-2 text-right">Balance</th>
                <th className="pb-2 text-right">Missed</th>
                <th className="pb-2 text-left">Next</th>
              </tr>
            </thead>
            <tbody>
              {dues.dues.map((d) => (
                <tr key={d._id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-semibold text-slate-700 dark:text-slate-300">{d.sewakId?.ownerName || "—"}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${d.status === "active" ? "bg-amber-50 text-amber-700" : d.status === "cleared" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{d.status}</span>
                  </td>
                  <td className="py-2 capitalize text-slate-500">{d.frequency}</td>
                  <td className="py-2 text-right tabular-nums text-slate-500">₹{d.instalmentAmount}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-600">₹{d.paidSoFar}</td>
                  <td className="py-2 text-right tabular-nums font-bold text-slate-700 dark:text-slate-300">₹{d.balance}</td>
                  <td className={`py-2 text-right tabular-nums ${d.missedCount > 0 ? "text-red-600 font-bold" : "text-slate-400"}`}>{d.missedCount}</td>
                  <td className="py-2 text-slate-500">
                    {d.status === "active" && d.nextDeductionDate
                      ? new Date(d.nextDeductionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminKitOrders;
