import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Package, Layers, Loader2, X, IndianRupee, ShoppingCart,
  Truck, CheckCircle2, Clock, XCircle, Wallet, Lock, Minus, Plus, AlertCircle
} from "lucide-react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { useToast } from "@/components/ui/use-toast";
import { useScrollLock } from "@/lib/scrollLock";
import API from "@/lib/api";

const STATUS_META = {
  pending: { label: "Awaiting confirmation", icon: Clock, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  dispatched: { label: "Dispatched", icon: Truck, cls: "text-sky-600 bg-sky-50 dark:bg-sky-950/40" },
  delivered: { label: "Delivered", icon: CheckCircle2, cls: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  cancelled: { label: "Cancelled", icon: XCircle, cls: "text-red-600 bg-red-50 dark:bg-red-950/40" },
};

const prettyDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const SewakKitStore = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState("store");
  const [catalog, setCatalog] = useState({ items: [], combos: [] });
  const [orders, setOrders] = useState([]);
  const [dues, setDues] = useState(null);
  const [loading, setLoading] = useState(true);

  const [checkout, setCheckout] = useState(null); // { type, entity }
  const [qty, setQty] = useState(1);
  const [paymentMode, setPaymentMode] = useState("full");
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [config, setConfig] = useState(null);
  const [blocking, setBlocking] = useState(null);

  useScrollLock(!!checkout);

  const fetchStore = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, cfgRes, trainRes] = await Promise.all([
        API.get("/kit-store/catalog"),
        API.get("/kit-store/payment-config"),
        API.get("/kit-store/training-status").catch(() => ({ data: null })),
      ]);
      setCatalog(catRes.data || { items: [], combos: [] });
      setConfig(cfgRes.data);
      setBlocking(trainRes.data?.applicable ? trainRes.data : null);
    } catch {
      toast({ title: "Could not load the kit store", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/kit-store/orders");
      setOrders(data || []);
    } catch {
      toast({ title: "Could not load your orders", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  const fetchDues = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/kit-store/dues");
      setDues(data);
    } catch {
      toast({ title: "Could not load your dues", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    if (tab === "store") fetchStore();
    else if (tab === "orders") fetchOrders();
    else fetchDues();
  }, [tab, fetchStore, fetchOrders, fetchDues]);

  const openCheckout = (type, entity) => {
    setCheckout({ type, entity });
    setQty(1);
    setPaymentMode(config?.paymentMode === "part" ? "part" : "full");
    setQuote(null);
  };

  // Re-quote whenever anything that affects the price changes, so the number
  // shown is always the number the server will charge.
  useEffect(() => {
    if (!checkout) return;
    let cancelled = false;
    setQuoting(true);
    API.post("/kit-store/quote", {
      orderType: checkout.type,
      itemId: checkout.type === "single" ? checkout.entity._id : undefined,
      comboId: checkout.type === "combo" ? checkout.entity._id : undefined,
      orderQuantity: qty,
      paymentMode,
    })
      .then(({ data }) => { if (!cancelled) setQuote(data); })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null);
          toast({ title: "Could not price this order", description: err.response?.data?.message, variant: "destructive" });
        }
      })
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [checkout, qty, paymentMode, toast]);

  const placeOrder = async () => {
    if (!quote) return;
    setPlacing(true);
    try {
      // Payment gateway step. Wired as a simulated confirmation here — swap
      // isSimulated for a real Razorpay checkout handler when keys are live.
      await API.post("/payment/verify-kit-order", {
        isSimulated: true,
        orderType: checkout.type,
        itemId: checkout.type === "single" ? checkout.entity._id : undefined,
        comboId: checkout.type === "combo" ? checkout.entity._id : undefined,
        orderQuantity: qty,
        paymentMode,
      });
      toast({ title: "Order placed", description: "You'll be notified once admin confirms it." });
      setCheckout(null);
      setTab("orders");
    } catch (err) {
      toast({ title: "Could not place order", description: err.response?.data?.message || "Please try again.", variant: "destructive" });
    } finally { setPlacing(false); }
  };

  const allowsFull = !config || config.paymentMode === "full" || config.paymentMode === "both";
  const allowsPart = config && (config.paymentMode === "part" || config.paymentMode === "both");

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 pb-24">
      <ProviderTopNav />

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-500" aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Starter Kits</h1>
            <p className="text-xs text-slate-500">Kits and combo packs for your category</p>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { id: "store", label: "Store" },
            { id: "orders", label: "My Orders" },
            { id: "dues", label: "Dues" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${tab === t.id ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-emerald-500" /></div>
        ) : tab === "store" ? (
          <StoreTab catalog={catalog} onBuy={openCheckout} blocking={blocking} />
        ) : tab === "orders" ? (
          <OrdersTab orders={orders} />
        ) : (
          <DuesTab dues={dues} />
        )}
      </div>

      {/* Checkout sheet */}
      <AnimatePresence>
        {checkout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={() => setCheckout(null)}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    {checkout.type === "combo" ? "Combo Pack" : "Starter Kit"}
                  </p>
                  <h2 className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{checkout.entity.name}</h2>
                </div>
                <button onClick={() => setCheckout(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Included</p>
                {checkout.type === "combo"
                  ? (checkout.entity.items || []).map((i) => (
                    <div key={String(i.itemId)} className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{i.name}</span>
                      <span className="font-black tabular-nums text-slate-500">×{i.kitQuantity * qty}</span>
                    </div>
                  ))
                  : (
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{checkout.entity.name}</span>
                      <span className="font-black tabular-nums text-slate-500">×{checkout.entity.kitQuantity * qty}</span>
                    </div>
                  )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Quantity</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:border-emerald-500" aria-label="Decrease">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-lg font-black tabular-nums text-slate-900 dark:text-white">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:border-emerald-500" aria-label="Increase">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {allowsFull && allowsPart && (
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Payment</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: "full", label: "Full Payment" }, { id: "part", label: "Part Payment" }].map((m) => (
                      <button key={m.id} onClick={() => setPaymentMode(m.id)}
                        className={`rounded-xl border-2 py-3 text-sm font-bold transition-colors ${paymentMode === m.id
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!allowsFull && (
                <p className="rounded-xl bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                  Your category requires part payment for kit purchases.
                </p>
              )}
              {allowsFull && !allowsPart && (
                <p className="rounded-xl bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                  Your category requires the full amount up front.
                </p>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                {quoting || !quote ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
                ) : (
                  <>
                    <Row label="Total" value={`₹${quote.totalAmount}`} />
                    <Row label="Pay now" value={`₹${quote.payNow}`} strong />
                    {quote.remaining > 0 && (
                      <>
                        <Row label="Remaining" value={`₹${quote.remaining}`} />
                        <div className="p-3">
                          <p className="text-[11px] text-slate-500">
                            ₹{quote.instalmentAmount} will be deducted <span className="font-bold">{quote.deductionFrequency}</span> from
                            your earnings wallet until the balance clears.
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <button onClick={placeOrder} disabled={placing || quoting || !quote}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                {quote ? `Pay ₹${quote.payNow}` : "Loading..."}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProviderBottomNav />
    </div>
  );
};

const Row = ({ label, value, strong }) => (
  <div className="flex items-center justify-between p-3">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
    <span className={`tabular-nums ${strong ? "text-lg font-black text-emerald-600" : "text-sm font-bold text-slate-700 dark:text-slate-300"}`}>{value}</span>
  </div>
);

const StoreTab = ({ catalog, onBuy, blocking }) => {
  const empty = !catalog.items.length && !catalog.combos.length;
  const blockingNames = new Set((blocking?.missingItems || []).map((i) => i.itemName));
  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center">
        <Package className="mx-auto h-9 w-9 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">Nothing available yet</p>
        <p className="mt-1 text-xs text-slate-500">No starter kits have been published for your category.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {blockingNames.size > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Your training is on hold</p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
              These mandatory items are missing: {[...blockingNames].join(", ")}. Order them below and bring them to your training centre.
            </p>
          </div>
        </div>
      )}

      {catalog.combos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Combo Packs</h2>
          {catalog.combos.map((c) => (
            <motion.div key={c._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5"><Layers className="h-5 w-5 text-emerald-600" /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-white">{c.name}</h3>
                  {c.description && <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
                {(c.items || []).map((i) => (
                  <div key={String(i.itemId)} className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{i.name}</span>
                    <span className="font-black tabular-nums text-slate-500">×{i.kitQuantity}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center text-xl font-black text-emerald-600 tabular-nums">
                  <IndianRupee className="h-4 w-4" />{c.comboPrice}
                </span>
                <button onClick={() => onBuy("combo", c)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Buy Pack</button>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {catalog.items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Individual Kits</h2>
          {catalog.items.map((i) => (
            <motion.div key={i._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 ${blockingNames.has(i.name) ? "border-amber-400 dark:border-amber-700 ring-2 ring-amber-200 dark:ring-amber-900/50" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">{i.name}</h3>
                    {i.isMandatory && (
                      <span className="rounded-full bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">Mandatory</span>
                    )}
                    {blockingNames.has(i.name) && (
                      <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Needed for training</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Quantity ×{i.kitQuantity} per kit</p>
                  <p className="mt-1 flex items-center text-base font-black text-emerald-600 tabular-nums">
                    <IndianRupee className="h-3.5 w-3.5" />{i.price}
                  </p>
                </div>
                <button onClick={() => onBuy("single", i)}
                  className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Buy</button>
              </div>
            </motion.div>
          ))}
        </section>
      )}
    </div>
  );
};

const OrdersTab = ({ orders }) => {
  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-20 text-center">
        <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
        <p className="mt-3 text-sm font-semibold text-slate-500">No orders yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const meta = STATUS_META[o.status] || STATUS_META.pending;
        const Icon = meta.icon;
        return (
          <motion.div key={o._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl p-2.5 ${meta.cls}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-black uppercase tracking-wider ${meta.cls.split(" ")[0]}`}>{meta.label}</p>
                <h3 className="mt-0.5 font-bold text-slate-900 dark:text-white">
                  {o.orderType === "combo" ? o.comboName : o.lines?.[0]?.itemName} × {o.orderQuantity}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Ordered {prettyDate(o.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
              {(o.lines || []).map((l, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{l.itemName}</span>
                  <span className="font-black tabular-nums text-slate-500">×{l.kitQuantity * o.orderQuantity}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-sm font-black tabular-nums text-slate-700 dark:text-slate-300">₹{o.totalAmount}</span>
              {o.paymentMode === "part" && (
                <span className="text-[11px] font-semibold text-slate-500">Paid ₹{o.downPaymentAmount} · Due ₹{o.remainingAmount}</span>
              )}
            </div>

            {o.expectedDeliveryDate && ["confirmed", "dispatched"].includes(o.status) && (
              <p className="flex items-center gap-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                <Truck className="h-3.5 w-3.5" />
                Expected delivery in {o.expectedDeliveryDays} day{o.expectedDeliveryDays === 1 ? "" : "s"} — by {prettyDate(o.expectedDeliveryDate)}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

const DuesTab = ({ dues }) => {
  if (!dues) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2.5"><Wallet className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wallet Balance</p>
            <p className={`text-2xl font-black tabular-nums ${dues.walletBalance < 0 ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
              ₹{dues.walletBalance}
            </p>
          </div>
        </div>
        {dues.totalOutstanding > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding Dues</span>
            <span className="text-lg font-black tabular-nums text-amber-600">₹{dues.totalOutstanding}</span>
          </div>
        )}
      </div>

      {dues.payoutLocked && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-400">Withdrawals paused</p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{dues.payoutLockReason}</p>
          </div>
        </div>
      )}

      {dues.dues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-16 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">No pending instalments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dues.dues.map((d) => (
            <div key={d._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {d.orderId?.comboName || d.orderId?.lines?.[0]?.itemName || "Kit order"}
                  </h3>
                  <p className="mt-0.5 text-xs capitalize text-slate-500">{d.frequency} · ₹{d.instalmentAmount} per instalment</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${d.status === "active" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : d.status === "cleared" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                  {d.status}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (d.paidSoFar / (d.totalDue || 1)) * 100)}%` }} />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-600 tabular-nums">₹{d.paidSoFar} paid</span>
                <span className="font-black text-slate-700 dark:text-slate-300 tabular-nums">₹{d.balance} left</span>
              </div>

              {d.status === "active" && d.nextDeductionDate && (
                <p className="text-[11px] text-slate-500">Next deduction: {prettyDate(d.nextDeductionDate)}</p>
              )}
              {d.missedCount > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {d.missedCount} instalment{d.missedCount === 1 ? "" : "s"} could not be collected — will retry
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SewakKitStore;
