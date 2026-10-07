import { useState, useEffect, useCallback } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import { motion } from "framer-motion";
import {
  Zap, Loader2, ArrowLeft, MapPin, Star, Clock, CheckCircle2, AlertTriangle, CalendarDays, Repeat,
} from "lucide-react";
import InstaLocationPicker, { EMPTY_PLACE, formatAddress } from "@/modules/user/components/InstaLocationPicker";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";
import { useSocket } from "@/context/SocketContext";

/**
 * Customer Insta Work screen.
 *
 * The two supply models are presented as genuinely different choices, because
 * they are: a Sewak is assigned by RozSewa at a fixed rate, whereas a Partner
 * is chosen by the customer from a list at that Partner's own rate. Showing a
 * Sewak "list" would imply a choice the customer does not have.
 */

const ACTIVE = [
  "REQUESTED", "MATCHING", "ASSIGNED", "PARTNER_SELECTED", "ACCEPTED",
  "ON_THE_WAY", "ARRIVED", "WORK_STARTED", "WORK_COMPLETED", "CUSTOMER_CONFIRMED",
];

const STATUS_COPY = {
  REQUESTED: "Finding a worker",
  MATCHING: "Finding a worker",
  ASSIGNED: "Sewak assigned — awaiting acceptance",
  PARTNER_SELECTED: "Partner notified — awaiting acceptance",
  ACCEPTED: "Accepted — preparing to travel",
  ON_THE_WAY: "Your worker is on the way",
  ARRIVED: "Your worker has arrived",
  WORK_STARTED: "Work in progress",
  WORK_COMPLETED: "Please confirm and pay",
  CUSTOMER_CONFIRMED: "Awaiting payment",
};

// Statuses before the worker sets off — a scheduled job waits in these.
const NOT_STARTED = ["REQUESTED", "MATCHING", "ASSIGNED", "PARTNER_SELECTED", "ACCEPTED"];

const istLabel = (d, opts) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });

/** IST yyyy-mm-dd of a moment. */
const istDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * A scheduled job is "upcoming" until shortly before its time; after that,
 * and for NOW help, it is the live job tracked on this screen.
 */
const isUpcoming = (j, now = Date.now()) =>
  j.bookingMode === "scheduled" && NOT_STARTED.includes(j.status) && j.scheduledFor &&
  new Date(j.scheduledFor).getTime() - now > 2 * 60 * 60 * 1000;

const InstaWork = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userCity, user } = useAuth();

  const [services, setServices] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Step 1 (spec §2): how the customer needs help.
  const [mode, setMode] = useState(null);
  const [scheduling, setScheduling] = useState({ enabled: true, minLeadMinutes: 60, maxAdvanceDays: 7, slotMinutes: 30 });
  const [schedDay, setSchedDay] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [place, setPlace] = useState(EMPTY_PLACE);
  const [upcoming, setUpcoming] = useState([]);
  const [step, setStep] = useState("mode");
  const [service, setService] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [supply, setSupply] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnersMsg, setPartnersMsg] = useState("");
  const [chosenPartner, setChosenPartner] = useState(null);
  // Insta Work is post-paid either way: the bill is only known when the timer
  // stops. This chooses how it gets settled then — cash in the worker's hand,
  // or through the gateway.
  const [paymentMode, setPaymentMode] = useState("cash");
  const { socket } = useSocket();
  const [quote, setQuote] = useState(null);

  const [activeJob, setActiveJob] = useState(null);
  const [live, setLive] = useState(null);

  // Where the worker comes: the location the customer picked and confirmed.
  const location = place.lat !== null
    ? { type: "Point", coordinates: [place.lng, place.lat] }
    : { type: "Point", coordinates: [0, 0] };

  // The chosen start time as an exact moment (IST), or null for NOW help.
  const scheduledFor = mode === "scheduled" && schedDay && schedTime ? `${schedDay}T${schedTime}:00+05:30` : null;
  const timing = { bookingMode: mode === "scheduled" ? "scheduled" : "now", scheduledFor };

  // Bookable days and start times, from the admin's scheduling rules.
  const scheduleDays = Array.from({ length: Math.max(1, Number(scheduling.maxAdvanceDays) || 7) }, (_, i) => {
    const d = new Date(Date.now() + i * 86400000);
    return { key: istDay(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : istLabel(d, { weekday: "short", day: "numeric", month: "short" }) };
  });
  const slotsFor = (day) => {
    const step = Number(scheduling.slotMinutes) || 30;
    const earliest = Date.now() + (Number(scheduling.minLeadMinutes) || 0) * 60000;
    const out = [];
    for (let m = 6 * 60; m <= 21 * 60; m += step) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const at = new Date(`${day}T${hh}:${mm}:00+05:30`).getTime();
      if (at >= earliest) out.push(`${hh}:${mm}`);
    }
    return out;
  };

  const loadServices = useCallback(async () => {
    try {
      const { data } = await API.get(`/insta/services${userCity ? `?city=${encodeURIComponent(userCity)}` : ""}`);
      setEnabled(data.enabled !== false);
      setServices(data.services || []);
      if (data.scheduling) setScheduling((s) => ({ ...s, ...data.scheduling }));
    } catch (err) {
      toast({ title: "Could not load Insta Work", variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCity]);

  const loadActiveJob = useCallback(async () => {
    try {
      const { data } = await API.get("/insta/jobs");
      const jobs = data.jobs || [];
      // Scheduled help still some way off is listed under Upcoming; it does
      // not take over the screen or stop the customer booking something else.
      setUpcoming(jobs.filter((j) => isUpcoming(j)).sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)));
      const running = jobs.find((j) => ACTIVE.includes(j.status) && !isUpcoming(j));
      if (!running) {
        setActiveJob(null);
        return;
      }
      const { data: detail } = await API.get(`/insta/jobs/${running._id}`);
      setActiveJob(detail.job);
      setLive(detail.live);
    } catch (err) {
      /* the booking view still works without it */
    }
  }, []);

  useEffect(() => {
    loadServices();
    loadActiveJob();
  }, [loadServices, loadActiveJob]);

  // A job in flight changes on the worker's actions, so poll while one is live.
  useEffect(() => {
    if (!activeJob) return;
    const t = setInterval(loadActiveJob, 5000);
    return () => clearInterval(t);
  }, [activeJob, loadActiveJob]);

  // The server announces every step of a job. Nothing was listening, so a
  // customer watching their worker arrive found out on the next poll —
  // up to five seconds after it happened. The poll stays as the fallback
  // for a dropped connection; this is what makes the screen feel live.
  useEffect(() => {
    if (!socket) return;
    const events = ["INSTA_JOB_CREATED","INSTA_JOB_ACCEPTED","INSTA_JOB_REASSIGNED","INSTA_PARTNER_DECLINED","INSTA_ON_THE_WAY","INSTA_ARRIVED","INSTA_WORK_STARTED","INSTA_EXTENSION_REQUESTED","INSTA_EXTENSION_RESPONSE","INSTA_WORK_COMPLETED","INSTA_JOB_PAID","INSTA_JOB_CANCELLED"];
    const refresh = () => { loadActiveJob(); };
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [socket]);

  // A different place or time can change who is free, so the worker choice
  // starts again whenever either changes.
  useEffect(() => {
    setSupply((s) => (service && service.availableFor.length === 1 ? s : null));
    setChosenPartner(null);
    setPartners([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.lat, place.lng, scheduledFor]);

  const pickMode = (m) => {
    setMode(m);
    setSchedDay("");
    setSchedTime("");
    setStep("browse");
  };

  const pickService = (svc) => {
    setService(svc);
    setQuantity(svc.minQuantity || 1);
    setSupply(svc.availableFor.length === 1 ? svc.availableFor[0] : null);
    setChosenPartner(null);
    setQuote(null);
    setStep("configure");
  };

  const refreshQuote = async (svc, qty, model, rate) => {
    try {
      const { data } = await API.post("/insta/quote", {
        serviceId: svc._id,
        quantity: qty,
        supplyModel: model,
        rate,
      });
      setQuote(data);
    } catch (err) {
      setQuote(null);
    }
  };

  const chooseSupply = async (model) => {
    setSupply(model);
    setChosenPartner(null);
    if (model === "sewak") {
      refreshQuote(service, quantity, "sewak");
      return;
    }
    setBusy(true);
    try {
      const { data } = await API.post("/insta/partners", { serviceId: service._id, location, quantity, ...timing });
      setPartners(data.partners || []);
      setPartnersMsg(data.emptyReason || "");
    } catch (err) {
      toast({ title: "Could not load Partners", description: err.response?.data?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const choosePartner = (p) => {
    setChosenPartner(p);
    refreshQuote(service, quantity, "partner", p.rate);
  };

  const book = async () => {
    setBusy(true);
    try {
      const { data } = await API.post("/insta/jobs", {
        serviceId: service._id,
        quantity,
        supplyModel: supply,
        providerId: chosenPartner?.providerId,
        address: formatAddress(place.details),
        addressDetails: place.details,
        contactName: place.contactName,
        contactMobile: place.contactMobile,
        location,
        city: place.details.city || userCity,
        paymentMode,
        ...timing,
      });
      toast({
        title: data.job.bookingMode === "scheduled" ? "Scheduled help booked" : "Insta Work booked",
        description: data.job.bookingMode === "scheduled"
          ? `Job ${data.job.jobCode} for ${istLabel(data.job.scheduledFor, { dateStyle: "medium", timeStyle: "short" })}.`
          : `Job ${data.job.jobCode} created.`,
      });
      setStep("mode");
      setMode(null);
      setService(null);
      await loadActiveJob();
    } catch (err) {
      toast({
        title: "Could not book",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const jobAction = async (path, body, title, jobId = activeJob?._id) => {
    setBusy(true);
    try {
      await API.patch(`/insta/jobs/${jobId}/${path}`, body || {});
      if (title) toast({ title });
      await loadActiveJob();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Settle an online job through the gateway.
   *
   * The order is raised by the server for this job's own final amount — the
   * browser never names a figure — and the job is only marked paid once
   * Razorpay hands back a signature the server can check against that order.
   * If the customer closes the checkout, nothing happens: the job stays
   * awaiting payment and they can try again.
   */
  const payOnline = async () => {
    setBusy(true);
    try {
      const { data: order } = await API.post(`/insta/jobs/${activeJob._id}/payment-order`);

      if (!window.Razorpay) {
        toast({
          title: "Payment unavailable",
          description: "Could not reach the payment gateway. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "RozSewa",
        description: `Insta Work ${order.jobCode}`,
        order_id: order.orderId,
        handler: async (response) => {
          try {
            // Straight through to the server, which checks the signature and
            // that this payment belongs to this job before it settles.
            await API.patch(`/insta/jobs/${activeJob._id}/pay`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast({ title: "Payment received" });
            await loadActiveJob();
          } catch (err) {
            toast({
              title: "Payment could not be confirmed",
              description: err.response?.data?.message,
              variant: "destructive",
            });
            await loadActiveJob();
          }
        },
        modal: {
          // Abandoning checkout is not a failure — the bill is still there.
          ondismiss: () => toast({ title: "Payment cancelled" }),
        },
        theme: { color: "#f59e0b" },
      });

      rzp.on("payment.failed", (e) =>
        toast({
          title: "Payment failed",
          description: e?.error?.description,
          variant: "destructive",
        })
      );
      rzp.open();
    } catch (err) {
      toast({
        title: "Could not start the payment",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <TopNav />
      <main className="container max-w-2xl space-y-5 px-4 py-6">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => (step === "mode" ? navigate("/") : setStep(step === "configure" ? "browse" : "mode"))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
              <Zap className="h-5 w-5 text-amber-500" /> Insta Work
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Book a worker for short or urgent jobs
            </p>
          </div>
        </div>

        {!enabled && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-muted-foreground">
              Insta Work isn't available right now.
            </p>
          </div>
        )}

        {/* ------------------------- Live job tracker ------------------------- */}
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/20"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
              {STATUS_COPY[activeJob.status] || activeJob.status}
            </p>
            <h3 className="mt-1 text-lg font-black text-foreground">{activeJob.serviceName}</h3>
            {activeJob.bookingMode === "scheduled" && activeJob.scheduledFor && (
              <p className="flex items-center gap-1 text-xs font-bold text-amber-700">
                <CalendarDays className="h-3.5 w-3.5" />
                Scheduled for {istLabel(activeJob.scheduledFor, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
            <p className="text-xs font-semibold text-muted-foreground">
              {activeJob.jobCode} · {activeJob.bookedQuantity} {activeJob.unitLabel}
              {activeJob.bookedQuantity === 1 ? "" : "s"} · ₹{activeJob.rate}/{activeJob.unitLabel}
            </p>

            {activeJob.providerId && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-card p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-700">
                  {(activeJob.providerId.ownerName || "W")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {activeJob.providerId.ownerName || activeJob.providerId.shopName}
                  </p>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {activeJob.providerId.mobile}
                    {activeJob.matchedEtaMinutes ? ` · ~${activeJob.matchedEtaMinutes} min away` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* The OTP is the customer's to hand over — it is never shown to the worker. */}
            {activeJob.status === "ARRIVED" && activeJob.startOTP && (
              <div className="mt-3 rounded-xl bg-card p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Share this OTP to start work
                </p>
                <p className="mt-1 font-mono text-3xl font-black tracking-[0.3em] text-foreground">
                  {activeJob.startOTP}
                </p>
                {live?.idleMinutes > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-rose-600">
                    Waiting charges running: {live.idleMinutes} min
                  </p>
                )}
              </div>
            )}

            {activeJob.status === "WORK_STARTED" && (
              <div className="mt-3 rounded-xl bg-card p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Time worked
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                  {live?.workedMinutes ?? 0} min
                </p>
              </div>
            )}

            {/* Extension approval — the timer cannot run past the booked time without it. */}
            {live?.pendingExtension && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-card p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  More time requested
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Your worker needs {live.pendingExtension.requestedMinutes} more minutes. The extra
                  time will be billed at the same rate.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => jobAction("extension", { approve: true }, "Extension approved")}
                    disabled={busy}
                    className="h-10 flex-1 rounded-xl bg-emerald-500 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => jobAction("extension", { approve: false }, "Extension declined")}
                    disabled={busy}
                    className="h-10 flex-1 rounded-xl bg-muted text-xs font-black uppercase tracking-wider text-muted-foreground disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Final bill */}
            {["WORK_COMPLETED", "CUSTOMER_CONFIRMED"].includes(activeJob.status) && (
              <div className="mt-3 rounded-xl bg-card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Final bill
                </p>
                <p className="text-3xl font-black text-foreground">₹{activeJob.finalAmount}</p>
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {(activeJob.billBreakdown || []).map((b, i) => (
                    <div key={i} className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>{b.label}</span>
                      <span>₹{b.amount}</span>
                    </div>
                  ))}
                </div>
                {activeJob.isTimed && (
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    Worked {activeJob.workedMinutes} min, billed as {activeJob.billedMinutes} min
                    ({activeJob.billingIntervalMinutes}-minute blocks).
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {activeJob.status === "WORK_COMPLETED" && (
                <button
                  onClick={() => jobAction("confirm", null, "Work confirmed")}
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-emerald-500 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="mr-1 inline h-4 w-4" /> Confirm work
                </button>
              )}
              {activeJob.status === "CUSTOMER_CONFIRMED" && (
                <button
                  onClick={
                    activeJob.paymentMode === "online"
                      ? payOnline
                      : () => jobAction("pay", null, "Payment recorded")
                  }
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-blue-600 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  {activeJob.paymentMode === "online"
                    ? `Pay ₹${activeJob.finalAmount} online`
                    : `Pay ₹${activeJob.finalAmount} in cash`}
                </button>
              )}
              {!["WORK_COMPLETED", "CUSTOMER_CONFIRMED"].includes(activeJob.status) && (
                <button
                  onClick={() => jobAction("cancel", { reason: "Cancelled by customer" }, "Job cancelled")}
                  disabled={busy}
                  className="h-11 rounded-xl bg-muted px-5 text-xs font-black uppercase tracking-wider text-muted-foreground disabled:opacity-50"
                >
                  Cancel job
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ------------------------- Upcoming scheduled ------------------------ */}
        {upcoming.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Upcoming
            </p>
            <div className="mt-2 space-y-2">
              {upcoming.map((j) => (
                <div key={j._id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-foreground">{j.serviceName}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {istLabel(j.scheduledFor, { dateStyle: "medium", timeStyle: "short" })} · {j.jobCode}
                    </p>
                    <p className="text-[11px] font-bold text-amber-600">
                      {j.status === "ACCEPTED" ? "Confirmed" : STATUS_COPY[j.status] || j.status}
                      {j.providerId?.ownerName ? ` · ${j.providerId.ownerName}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => jobAction("cancel", { reason: "Cancelled by customer" }, "Booking cancelled", j._id)}
                    disabled={busy}
                    className="shrink-0 rounded-lg bg-card px-3 py-2 text-[11px] font-black uppercase text-muted-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------- Step 1: how do you need help? ------------------- */}
        {enabled && step === "mode" && !activeJob && (
          <div className="space-y-3">
            <h2 className="text-lg font-black text-foreground">How do you need help?</h2>
            {[
              { id: "now", Icon: Zap, title: "NOW HELP", desc: "Help right away — the nearest available worker comes over." },
              { id: "scheduled", Icon: CalendarDays, title: "SCHEDULED HELP", desc: "Pick a date and time that suits you.", off: scheduling.enabled === false },
              { id: "monthly", Icon: Repeat, title: "MONTHLY HOMEHELP", desc: "Regular help with fixed monthly hours or visits.", soon: true },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => !m.soon && !m.off && pickMode(m.id)}
                disabled={m.soon || m.off}
                className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition hover:border-amber-400 disabled:opacity-60"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30">
                  <m.Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground">
                    {m.title}
                    {(m.soon || m.off) && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase text-muted-foreground">
                        {m.soon ? "Coming soon" : "Unavailable"}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* --------------------------- Service list --------------------------- */}
        {enabled && step === "browse" && !activeJob && (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="col-span-full text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              {mode === "scheduled" ? "Scheduled help" : "Now help"} · Select a service
            </p>
            {services.filter((s) => s.modes?.[mode] !== false).length === 0 && (
              <p className="col-span-full py-10 text-center text-sm font-semibold text-muted-foreground">
                No Insta Work services available in your area yet.
              </p>
            )}
            {services.filter((s) => s.modes?.[mode] !== false).map((s) => (
              <button
                key={s._id}
                onClick={() => pickService(s)}
                className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-amber-400"
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                  <CategoryIcon icon={s.icon} label={s.name} className="h-6 w-6" imgClassName="h-full w-full object-cover" />
                </div>
                <p className="mt-3 text-sm font-black text-foreground">{s.name}</p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.description}</p>
                <p className="mt-2 text-xs font-bold text-amber-600">
                  {s.availableFor.includes("sewak")
                    ? `₹${s.sewakRate}/${s.unitLabel}`
                    : `₹${s.minRate}–₹${s.maxRate}/${s.unitLabel}`}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ---------------------------- Configure ---------------------------- */}
        {enabled && step === "configure" && service && !activeJob && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
                {service.name}
              </h2>

              {service.pricingType !== "custom" && (
                <div className="mt-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    How many {service.unitLabel}s?
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => {
                        const q = Math.max(service.minQuantity, quantity - 1);
                        setQuantity(q);
                        if (supply) refreshQuote(service, q, supply, chosenPartner?.rate);
                      }}
                      className="h-11 w-11 rounded-xl bg-muted text-lg font-black"
                    >
                      −
                    </button>
                    <span className="min-w-[4rem] text-center text-2xl font-black tabular-nums text-foreground">
                      {quantity}
                    </span>
                    <button
                      onClick={() => {
                        const q = Math.min(service.maxQuantity, quantity + 1);
                        setQuantity(q);
                        if (supply) refreshQuote(service, q, supply, chosenPartner?.rate);
                      }}
                      className="h-11 w-11 rounded-xl bg-muted text-lg font-black"
                    >
                      +
                    </button>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {service.unitLabel}s (max {service.maxQuantity})
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Where (spec §6) */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-foreground">Where do you need help?</h3>
              <InstaLocationPicker value={place} onChange={setPlace} user={user} />
            </div>

            {/* When (spec §10) */}
            {mode === "scheduled" && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Date &amp; time</h3>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {scheduleDays.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => { setSchedDay(d.key); setSchedTime(""); }}
                      className={`shrink-0 rounded-xl border-2 px-3 py-2 text-xs font-black ${schedDay === d.key ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30" : "border-border"}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {schedDay && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {slotsFor(schedDay).length === 0 && (
                      <p className="col-span-4 text-xs font-semibold text-muted-foreground">No times left on this day. Choose another day.</p>
                    )}
                    {slotsFor(schedDay).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSchedTime(t)}
                        className={`rounded-lg border px-2 py-2 text-xs font-bold tabular-nums ${schedTime === t ? "border-amber-500 bg-amber-500 text-white" : "border-border"}`}
                      >
                        {new Date(`2000-01-01T${t}:00`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Supply choice — once we know where and when */}
            {place.confirmed && (mode !== "scheduled" || scheduledFor) && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                Who should do this job?
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {service.availableFor.includes("sewak") && (
                  <button
                    onClick={() => chooseSupply("sewak")}
                    className={`rounded-xl border-2 p-4 text-left transition ${
                      supply === "sewak" ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/10" : "border-border"
                    }`}
                  >
                    <p className="text-sm font-black text-foreground">RozSewa Sewak</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      We assign the nearest available worker automatically.
                    </p>
                    <p className="mt-2 text-xs font-black text-amber-600">
                      ₹{service.sewakRate}/{service.unitLabel} · fixed
                    </p>
                  </button>
                )}
                {service.availableFor.includes("partner") && (
                  <button
                    onClick={() => chooseSupply("partner")}
                    className={`rounded-xl border-2 p-4 text-left transition ${
                      supply === "partner" ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/10" : "border-border"
                    }`}
                  >
                    <p className="text-sm font-black text-foreground">Local Expert</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Choose a Partner yourself from those nearby.
                    </p>
                    <p className="mt-2 text-xs font-black text-amber-600">
                      ₹{service.minRate}–₹{service.maxRate}/{service.unitLabel}
                    </p>
                  </button>
                )}
              </div>
            </div>
            )}

            {/* Partner list */}
            {supply === "partner" && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                  Available Partners
                </h3>
                {busy && <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-amber-500" />}
                {!busy && partners.length === 0 && (
                  <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
                    {partnersMsg || "No Partners available right now."}
                  </p>
                )}
                <div className="mt-3 space-y-2">
                  {partners.map((p) => (
                    <button
                      key={p.providerId}
                      onClick={() => choosePartner(p)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
                        chosenPartner?.providerId === p.providerId
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/10"
                          : "border-border"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-black">
                        {(p.name || "P")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground">{p.name}</p>
                        <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {p.rating || "New"}
                          </span>
                          {p.distanceKm !== null && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {p.distanceKm} km
                            </span>
                          )}
                          {p.etaMinutes && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />~{p.etaMinutes} min
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-foreground">
                        ₹{p.rate}
                        <span className="text-[10px] font-bold text-muted-foreground">
                          /{service.unitLabel}
                        </span>
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Estimate + book */}
            {quote && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-black uppercase tracking-wider text-muted-foreground">
                    Estimate
                  </span>
                  <span className="text-2xl font-black text-foreground">₹{quote.subtotal}</span>
                </div>
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {quote.breakdown.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>{b.label}</span>
                      <span>₹{b.amount}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">{quote.note}</p>

                {/* An unpaid cancellation fee joins this booking. Shown here,
                    before they commit, rather than appearing on the final bill —
                    a charge that turns up only after the work is done is the
                    kind people dispute. */}
                {quote.pendingCancellationFeeTotal > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Unpaid cancellation {quote.pendingCancellationFees.length > 1 ? "fees" : "fee"}
                    </p>
                    <div className="mt-1.5 space-y-1">
                      {quote.pendingCancellationFees.map((fee) => (
                        <div key={fee.jobId} className="flex justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                          <span>{fee.jobCode}</span>
                          <span>₹{fee.amount}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between border-t border-amber-300/60 pt-2 dark:border-amber-900/50">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        You will pay
                      </span>
                      <span className="text-lg font-black text-amber-900 dark:text-amber-200">₹{quote.estimatedTotal}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      Added to this booking from a job you cancelled earlier.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Chosen now, settled later: the bill is not known until the
                timer stops, so this only decides how it gets paid then. */}
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                How would you like to pay?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "cash", label: "Cash", hint: "Pay the worker when the job ends" },
                  { id: "online", label: "Online", hint: "Pay in the app once it is done" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMode(m.id)}
                    className={`rounded-2xl border p-3 text-left transition-colors ${
                      paymentMode === m.id
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                        : "border-border bg-card"
                    }`}
                  >
                    <span className="block text-sm font-black text-foreground">{m.label}</span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-snug text-muted-foreground">
                      {m.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={book}
              disabled={busy || !supply || !place.confirmed || (mode === "scheduled" && !scheduledFor) || (supply === "partner" && !chosenPartner)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {!place.confirmed
                ? "Confirm the location first"
                : mode === "scheduled" && !scheduledFor
                  ? "Choose a date & time"
                  : !supply
                    ? "Choose who should do this job"
                    : mode === "scheduled"
                      ? `Book for ${istLabel(scheduledFor, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                      : supply === "sewak"
                        ? "Book a Sewak now"
                        : "Book this Partner"}
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default InstaWork;
