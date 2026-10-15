import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, MapPin, CalendarDays, ChevronRight, Check, X, Loader2 } from "lucide-react";
import API from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

/** Where an Insta Work job sits on the partner's New / Active tabs. */
export const INSTA_NEW = ["ASSIGNED", "PARTNER_SELECTED"];
export const INSTA_ACTIVE = ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "WORK_STARTED", "WORK_COMPLETED", "CUSTOMER_CONFIRMED"];

const STATUS_COPY = {
  ASSIGNED: "New request",
  PARTNER_SELECTED: "Customer chose you",
  ACCEPTED: "Accepted",
  ON_THE_WAY: "On the way",
  ARRIVED: "Arrived",
  WORK_STARTED: "Work in progress",
  WORK_COMPLETED: "Awaiting confirmation",
  CUSTOMER_CONFIRMED: "Awaiting payment",
};

const when = (d) =>
  new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/**
 * One Insta Work job in the home list. A new request can be accepted or
 * declined right here; the rest of the job (on the way, OTP, finish) is
 * worked on the Insta Work screen, which the card opens.
 */
const InstaJobCard = ({ job, onChanged }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null); // "accept" | "reject" | null
  const [confirmReject, setConfirmReject] = useState(false);
  // A ref, not state: two quick taps arrive before a re-render and would
  // send the same answer twice.
  const sending = useRef(false);

  const isNew = INSTA_NEW.includes(job.status);
  const scheduled = job.bookingMode === "scheduled" && job.scheduledFor;

  const answer = async (action) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(action);
    try {
      await API.patch(`/insta/provider/jobs/${job._id}/${action}`);
      toast({ title: action === "accept" ? "Job accepted" : "Job declined" });
    } catch (err) {
      toast({
        title: action === "accept" ? "Could not accept" : "Could not decline",
        description: err.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      // Refresh either way: a failure usually means the job already moved on.
      sending.current = false;
      setBusy(null);
      setConfirmReject(false);
      onChanged?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      data-insta-job={job._id}
      className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-card shadow-sm transition-shadow hover:shadow-md dark:border-amber-900/40 dark:from-amber-950/25"
    >
      <Link to="/provider/insta-work" className="group block p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            <Zap className="h-3 w-3 fill-white" /> Insta Work
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isNew
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            }`}
          >
            {STATUS_COPY[job.status] || job.status}
          </span>
        </div>

        <h3 className="truncate text-lg font-black text-foreground">{job.serviceName}</h3>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{job.jobCode}</p>

        {scheduled && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-400">
            <CalendarDays className="h-3.5 w-3.5" /> {when(job.scheduledFor)}
          </p>
        )}
        {job.address && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{job.address}</span>
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-amber-200/60 pt-3 dark:border-amber-900/30">
          <span className="text-sm font-black text-foreground">
            {Number(job.estimateAmount) > 0 ? `₹${Number(job.estimateAmount).toLocaleString("en-IN")}` : "Priced on site"}
          </span>
          {!isNew && (
            <span className="flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-400">
              Open job <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </Link>

      {isNew && (
        <div className="border-t border-amber-200/60 p-3 dark:border-amber-900/30" data-insta-actions>
          {confirmReject ? (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-xs font-bold text-foreground">Decline this job?</p>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setConfirmReject(false)}
                className="h-10 rounded-xl border border-border bg-background px-4 text-xs font-black text-foreground disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => answer("reject")}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-black text-white disabled:opacity-60"
              >
                {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Yes, decline
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-insta-reject
                disabled={!!busy}
                onClick={() => setConfirmReject(true)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-black uppercase tracking-wider text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
              >
                <X className="h-4 w-4" /> Reject
              </button>
              <button
                type="button"
                data-insta-accept
                disabled={!!busy}
                onClick={() => answer("accept")}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-wider text-white shadow-sm shadow-emerald-600/25 transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default InstaJobCard;
