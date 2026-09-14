import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Zap, Loader2, ArrowLeft, MapPin, Star, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/modules/user/components/TopNav";
import BottomNav from "@/modules/user/components/BottomNav";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

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

const InstaWork = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userLocation, userCity } = useAuth();

  const [services, setServices] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState("browse");
  const [service, setService] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [supply, setSupply] = useState(null);
  const [partners, setPartners] = useState([]);
  const [partnersMsg, setPartnersMsg] = useState("");
  const [chosenPartner, setChosenPartner] = useState(null);
  const [address, setAddress] = useState("");
  const [quote, setQuote] = useState(null);

  const [activeJob, setActiveJob] = useState(null);
  const [live, setLive] = useState(null);

  const location = userLocation
    ? { type: "Point", coordinates: [userLocation.lng, userLocation.lat] }
    : { type: "Point", coordinates: [0, 0] };

  const loadServices = useCallback(async () => {
    try {
      const { data } = await API.get(`/insta/services${userCity ? `?city=${encodeURIComponent(userCity)}` : ""}`);
      setEnabled(data.enabled !== false);
      setServices(data.services || []);
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
      const running = (data.jobs || []).find((j) => ACTIVE.includes(j.status));
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

  useEffect(() => {
    if (userLocation && !address) {
      setAddress(userCity ? `Current location, ${userCity}` : "Current location");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, userCity]);

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
      const { data } = await API.post("/insta/partners", { serviceId: service._id, location });
      setPartners(data.partners || []);
      setPartnersMsg(data.emptyReason || "");
    } catch (err) {
      toast({ title: "Could not load Partners", variant: "destructive" });
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
        address,
        location,
        city: userCity,
        paymentMode: "cash",
      });
      toast({ title: "Insta Work booked", description: `Job ${data.job.jobCode} created.` });
      setStep("browse");
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

  const jobAction = async (path, body, title) => {
    setBusy(true);
    try {
      await API.patch(`/insta/jobs/${activeJob._id}/${path}`, body || {});
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
            onClick={() => (step === "browse" ? navigate("/") : setStep("browse"))}
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
                  onClick={() => jobAction("pay", null, "Payment recorded")}
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-blue-600 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  Pay ₹{activeJob.finalAmount}
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

        {/* --------------------------- Service list --------------------------- */}
        {enabled && step === "browse" && !activeJob && (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm font-semibold text-muted-foreground">
                No Insta Work services available in your area yet.
              </p>
            )}
            {services.map((s) => (
              <button
                key={s._id}
                onClick={() => pickService(s)}
                className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-amber-400"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Zap className="h-5 w-5 text-amber-600" />
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

              <div className="mt-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Service address
                </p>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Where should the worker come?"
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Supply choice */}
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

            <button
              onClick={book}
              disabled={busy || !supply || !address || (supply === "partner" && !chosenPartner)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {!supply
                ? "Choose who should do this job"
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
