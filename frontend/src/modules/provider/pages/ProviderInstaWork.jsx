import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Zap, Loader2, MapPin, Play, Square, Clock, CheckCircle2, XCircle, AlertTriangle, Timer,
} from "lucide-react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

/**
 * Provider / Sewak Insta Work screen.
 *
 * Two jobs in one page: the worker's availability settings, and the live
 * lifecycle controls for whatever job they currently hold. Keeping them
 * together matters because the worker acts on them in the same moment — going
 * live, then immediately working the job that arrives.
 */

const ACTIVE_STATUSES = [
  "ASSIGNED", "PARTNER_SELECTED", "ACCEPTED", "ON_THE_WAY",
  "ARRIVED", "WORK_STARTED", "WORK_COMPLETED", "CUSTOMER_CONFIRMED",
];

const STATUS_COPY = {
  ASSIGNED: "Assigned to you",
  PARTNER_SELECTED: "Customer chose you",
  ACCEPTED: "Accepted",
  ON_THE_WAY: "On the way",
  ARRIVED: "Arrived — waiting to start",
  WORK_STARTED: "Work in progress",
  WORK_COMPLETED: "Awaiting customer confirmation",
  CUSTOMER_CONFIRMED: "Awaiting payment",
};

const ProviderInstaWork = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [tick, setTick] = useState(0);
  // Why the last position report failed, if it did. Shown to the worker:
  // a blocked location silently removes them from matching, and "you are
  // live" while nobody can find you is the worst thing this screen can say.
  const [locationError, setLocationError] = useState(null);
  const pingRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [p, j] = await Promise.all([
        API.get("/insta/provider/profile"),
        API.get("/insta/provider/jobs"),
      ]);
      setProfile(p.data);
      setJobs(j.data.jobs || []);
    } catch (err) {
      toast({
        title: "Could not load Insta Work",
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

  // Re-render once a second so the running timer stays honest without
  // hammering the server.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * While Insta Work is on, the app reports position periodically. Matching
   * treats a stale ping as offline, so this is what actually keeps the worker
   * visible — the toggle alone is not enough.
   */
  useEffect(() => {
    const stop = () => {
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
    };
    if (!profile?.enabled) {
      stop();
      return stop;
    }

    const send = () => {
      if (!navigator.geolocation) {
        setLocationError("This device cannot share a location.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationError(null);
          API.post("/insta/provider/ping", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }).catch(() => { /* a dropped ping is retried on the next tick */ });
        },
        (err) => {
          setLocationError(
            err.code === err.PERMISSION_DENIED
              ? "Location access is blocked. Allow it in your browser settings, or you will not receive jobs."
              : "Could not read your location. You may stop receiving jobs until it works.",
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      );
    };

    send();
    pingRef.current = setInterval(send, 60000);
    return stop;
  }, [profile?.enabled]);

  const activeJob = jobs.find((j) => ACTIVE_STATUSES.includes(j.status));

  const act = async (fn, successTitle) => {
    setBusy(true);
    try {
      await fn();
      if (successTitle) toast({ title: successTitle });
      await load();
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

  const toggle = () =>
    act(async () => {
      const { data } = await API.patch("/insta/provider/toggle", {
        enabled: !profile.enabled,
      });
      toast({ title: data.message });
    });

  const toggleService = (svc) =>
    act(async () => {
      const current = profile.services.filter((s) => s.selected);
      const next = svc.selected
        ? current.filter((s) => s._id !== svc._id)
        : [...current, svc];
      await API.put("/insta/provider/services", {
        services: next.map((s) => ({ serviceId: s._id, rate: s.rate })),
      });
    });

  const saveRate = (svc, rate) =>
    act(async () => {
      const current = profile.services.filter((s) => s.selected);
      await API.put("/insta/provider/services", {
        services: current.map((s) => ({
          serviceId: s._id,
          rate: s._id === svc._id ? Number(rate) : s.rate,
        })),
      });
    }, "Rate updated");

  const jobAction = (path, body, title) =>
    act(async () => {
      await API.patch(`/insta/provider/jobs/${activeJob._id}/${path}`, body || {});
    }, title);

  /** Live elapsed minutes on a running job. */
  const elapsedMinutes = () => {
    if (!activeJob?.workStartedAt) return 0;
    return Math.floor((Date.now() - new Date(activeJob.workStartedAt).getTime()) / 60000);
  };

  const elapsedLabel = () => {
    if (!activeJob?.workStartedAt) return "00:00:00";
    const s = Math.max(0, Math.floor((Date.now() - new Date(activeJob.workStartedAt).getTime()) / 1000));
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };

  // Mirrors the server rule: booked time plus the admin threshold.
  const overrunNeedsApproval = () => {
    if (!activeJob || activeJob.status !== "WORK_STARTED" || !activeJob.isTimed) return false;
    const bookedMinutes = (activeJob.bookedQuantity || 0) * 60;
    const allowed = bookedMinutes + (activeJob.approvedExtraMinutes || 0) + 30;
    return elapsedMinutes() > allowed;
  };

  const pendingExtension = activeJob?.extensions?.find((e) => e.status === "pending");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ProviderTopNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-3xl space-y-5 px-4 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-foreground">
            <Zap className="h-6 w-6 text-amber-500" />
            Insta Work
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Go live to receive instant, short-duration jobs near you.
          </p>
        </div>

        {profile.disabledByAdmin && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Insta Work has been disabled on your account. Please contact support.
            </p>
          </div>
        )}

        {/* Availability */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-foreground">
                {profile.enabled ? "You are live" : "You are offline"}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {profile.enabled
                  ? "Keep this app open — your location updates automatically."
                  : "Turn on to start receiving Insta Work jobs."}
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={busy || profile.disabledByAdmin}
              className={`h-12 shrink-0 rounded-xl px-6 text-xs font-black uppercase tracking-widest transition disabled:opacity-50 ${
                profile.enabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {profile.enabled ? "Live" : "Go live"}
            </button>
          </div>
          {profile.enabled && locationError && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] font-semibold text-rose-600">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {locationError}
            </p>
          )}
          {profile.enabled && !locationError && profile.lastPingAt && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <MapPin className="h-3.5 w-3.5" />
              Location shared {new Date(profile.lastPingAt).toLocaleTimeString("en-IN")}
            </p>
          )}
        </div>

        {/* Active job */}
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                  {STATUS_COPY[activeJob.status] || activeJob.status}
                </p>
                <h3 className="mt-1 text-lg font-black text-foreground">{activeJob.serviceName}</h3>
                <p className="text-xs font-semibold text-muted-foreground">
                  {activeJob.jobCode} · {activeJob.bookedQuantity} {activeJob.unitLabel}
                  {activeJob.bookedQuantity === 1 ? "" : "s"} · ₹{activeJob.rate}/{activeJob.unitLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{activeJob.address}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Estimate</p>
                <p className="text-xl font-black text-foreground">₹{activeJob.estimateAmount}</p>
              </div>
            </div>

            {/* Running timer */}
            {activeJob.status === "WORK_STARTED" && activeJob.isTimed && (
              <div className="mt-4 rounded-xl bg-card p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Time on site
                </p>
                <p className="mt-1 font-mono text-3xl font-black tabular-nums text-foreground">
                  {elapsedLabel()}
                </p>
                {overrunNeedsApproval() && !pendingExtension && (
                  <p className="mt-2 text-[11px] font-bold text-rose-600">
                    Past the booked time — request an extension to keep going.
                  </p>
                )}
                {pendingExtension && (
                  <p className="mt-2 text-[11px] font-bold text-amber-600">
                    Waiting for the customer to approve {pendingExtension.requestedMinutes} more minutes.
                  </p>
                )}
              </div>
            )}

            {activeJob.status === "ARRIVED" && (
              <div className="mt-4 rounded-xl bg-card p-4">
                <p className="text-xs font-bold text-foreground">
                  Ask the customer for their 4-digit start OTP.
                </p>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  inputMode="numeric"
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-background text-center font-mono text-2xl font-black tracking-[0.4em] outline-none focus:border-amber-500"
                />
              </div>
            )}

            {activeJob.status === "WORK_COMPLETED" && (
              <div className="mt-4 rounded-xl bg-card p-4">
                <p className="text-xs font-black uppercase text-muted-foreground">Final bill</p>
                <p className="text-2xl font-black text-foreground">₹{activeJob.finalAmount}</p>
                <div className="mt-2 space-y-1">
                  {(activeJob.billBreakdown || []).map((b, i) => (
                    <div key={i} className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>{b.label}</span>
                      <span>₹{b.amount}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                  Waiting for the customer to confirm and pay.
                </p>
              </div>
            )}

            {/* Lifecycle actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {["ASSIGNED", "PARTNER_SELECTED"].includes(activeJob.status) && (
                <>
                  <button
                    onClick={() => jobAction("accept", null, "Job accepted")}
                    disabled={busy}
                    className="h-11 flex-1 rounded-xl bg-emerald-500 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => jobAction("reject", null, "Job declined")}
                    disabled={busy}
                    className="h-11 rounded-xl bg-muted px-5 text-xs font-black uppercase tracking-wider text-muted-foreground disabled:opacity-50"
                  >
                    Decline
                  </button>
                </>
              )}

              {activeJob.status === "ACCEPTED" && (
                <button
                  onClick={() => jobAction("on-the-way", null, "Customer notified")}
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-blue-600 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  Start journey
                </button>
              )}

              {["ACCEPTED", "ON_THE_WAY"].includes(activeJob.status) && (
                <button
                  onClick={() => jobAction("arrived", null, "Arrival recorded")}
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-amber-500 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  <MapPin className="mr-1 inline h-4 w-4" /> I have arrived
                </button>
              )}

              {activeJob.status === "ARRIVED" && (
                <button
                  onClick={() =>
                    act(async () => {
                      await API.patch(`/insta/provider/jobs/${activeJob._id}/start`, { otp });
                      setOtp("");
                    }, "Work started")
                  }
                  disabled={busy || otp.length !== 4}
                  className="h-11 flex-1 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  <Play className="mr-1 inline h-4 w-4" /> Verify OTP & start
                </button>
              )}

              {activeJob.status === "WORK_STARTED" && (
                <>
                  {!pendingExtension && (
                    <button
                      onClick={() =>
                        act(async () => {
                          await API.post(`/insta/provider/jobs/${activeJob._id}/extension`, { minutes: 30 });
                        }, "Extension requested")
                      }
                      disabled={busy}
                      className="h-11 rounded-xl bg-muted px-4 text-xs font-black uppercase tracking-wider text-muted-foreground disabled:opacity-50"
                    >
                      <Timer className="mr-1 inline h-4 w-4" /> Request +30 min
                    </button>
                  )}
                  {!activeJob.isTimed && (
                    <input
                      value={actualQty}
                      onChange={(e) => setActualQty(e.target.value)}
                      placeholder={`Actual ${activeJob.unitLabel}s`}
                      type="number"
                      className="h-11 w-36 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none"
                    />
                  )}
                  <button
                    onClick={() =>
                      jobAction(
                        "stop",
                        actualQty !== "" ? { actualQuantity: Number(actualQty) } : {},
                        "Work completed",
                      )
                    }
                    disabled={busy}
                    className="h-11 flex-1 rounded-xl bg-rose-600 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                  >
                    <Square className="mr-1 inline h-4 w-4" /> Stop & bill
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Services */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
            Services you offer
          </h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {profile.canSetRate
              ? "Tick a service and set your rate within the allowed range."
              : "Tick the services you can take. Rates are set by RozSewa."}
          </p>

          <div className="mt-4 space-y-2">
            {profile.services.length === 0 && (
              <p className="py-6 text-center text-sm font-semibold text-muted-foreground">
                No Insta Work services are available for your account type yet.
              </p>
            )}
            {profile.services.map((svc) => (
              <div
                key={svc._id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
                  svc.selected ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/10" : "border-border"
                }`}
              >
                <button
                  onClick={() => toggleService(svc)}
                  disabled={busy}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                    svc.selected ? "border-amber-500 bg-amber-500 text-white" : "border-border"
                  }`}
                >
                  {svc.selected && <CheckCircle2 className="h-4 w-4" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{svc.name}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {profile.canSetRate
                      ? `Allowed: ₹${svc.minRate} – ₹${svc.maxRate} per ${svc.unitLabel}`
                      : `RozSewa rate: ₹${svc.fixedRate} per ${svc.unitLabel}`}
                  </p>
                </div>

                {profile.canSetRate && svc.selected && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">₹</span>
                    <input
                      type="number"
                      defaultValue={svc.rate}
                      min={svc.minRate}
                      max={svc.maxRate}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== svc.rate) saveRate(svc, v);
                      }}
                      className="h-10 w-24 rounded-lg border border-border bg-background px-2 text-sm font-bold outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Working hours */}
        {profile.canSetHours && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Working hours
            </h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Leave blank to take Insta Work whenever you are live.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="time"
                defaultValue={profile.workingHours?.start || ""}
                onBlur={(e) =>
                  act(async () => {
                    await API.put("/insta/provider/hours", {
                      start: e.target.value,
                      end: profile.workingHours?.end || "",
                    });
                  }, "Hours updated")
                }
                className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none"
              />
              <span className="text-xs font-bold text-muted-foreground">to</span>
              <input
                type="time"
                defaultValue={profile.workingHours?.end || ""}
                onBlur={(e) =>
                  act(async () => {
                    await API.put("/insta/provider/hours", {
                      start: profile.workingHours?.start || "",
                      end: e.target.value,
                    });
                  }, "Hours updated")
                }
                className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none"
              />
            </div>
          </div>
        )}

        {/* History */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-foreground">
              Recent Insta jobs
            </h2>
          </div>
          {jobs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm font-semibold text-muted-foreground">
              No Insta Work jobs yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {jobs.slice(0, 10).map((j) => (
                <div key={j._id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{j.serviceName}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {j.jobCode} · {new Date(j.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-foreground">
                      ₹{j.finalAmount || j.estimateAmount}
                    </p>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">{j.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <ProviderBottomNav />
    </div>
  );
};

export default ProviderInstaWork;
