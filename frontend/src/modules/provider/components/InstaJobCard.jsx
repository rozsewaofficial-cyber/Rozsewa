import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, MapPin, CalendarDays, ChevronRight } from "lucide-react";

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
 * One Insta Work job in the home list. Insta Work jobs live apart from
 * bookings, so they are shown with their own badge; every action (accept,
 * start, OTP, finish) stays on the Insta Work screen, which this opens.
 */
const InstaJobCard = ({ job }) => {
  const isNew = INSTA_NEW.includes(job.status);
  const scheduled = job.bookingMode === "scheduled" && job.scheduledFor;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Link
        to="/provider/insta-work"
        data-insta-job={job._id}
        className="group relative block overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-card p-4 shadow-sm transition-all hover:shadow-md dark:border-amber-900/40 dark:from-amber-950/25"
      >
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
          <span className="flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-400">
            {isNew ? "Respond" : "Open job"} <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
};

export default InstaJobCard;
