import { Link } from "react-router-dom";
import { Percent, ArrowRight, Gift, Crown, Layers } from "lucide-react";

/**
 * "Your commission" on the partner home: one rate, up front, and two or three
 * facts that explain it. The three situations (free trial, membership, plain
 * category slab) share one layout so the card never jumps around.
 */
const Stat = ({ label, value }) => (
  <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2.5">
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-0.5 truncate text-sm font-extrabold text-foreground">{value}</p>
  </div>
);

const rupees = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** "21.41-13000" → "₹21 – ₹13,000"; anything else is shown as it came. */
const prettyRange = (range) => {
  const m = String(range || "").match(/^s*([d.]+)s*[-–]s*([d.]+)s*$/);
  return m ? `${rupees(m[1])} – ${rupees(m[2])}` : range || "All";
};

const FREE_JOBS = 3;

const CommissionOverviewCard = ({ preview }) => {
  if (!preview) return null;

  const source = preview.appliedSource;
  const sub = preview.activeSubscription;
  const isTrial = source === "FREE_TRIAL";
  const isMember = source === "SUBSCRIPTION" && !!sub;

  const rate = isTrial ? 0 : Number(preview.currentCommissionPercentage ?? 0);

  const tone = isTrial
    ? { chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", rate: "text-emerald-600 dark:text-emerald-400", icon: Gift }
    : isMember
      ? { chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", rate: "text-violet-600 dark:text-violet-400", icon: Crown }
      : { chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", rate: "text-emerald-600 dark:text-emerald-400", icon: Layers };
  const Icon = tone.icon;

  const chip = isTrial
    ? "Free trial"
    : isMember
      ? `${sub.planName} member`
      : source === "PROVIDER_OVERRIDE"
        ? "Special rate"
        : source === "WAIVER"
          ? "Commission waived"
          : "Standard rate";

  const stats = isTrial
    ? [
        { label: "Free jobs left", value: `${preview.remainingFreeServices ?? 0} of 3` },
        { label: "After the trial", value: "Category rate" },
      ]
    : isMember
      ? [
          { label: "Days left", value: `${sub.daysRemaining} days` },
          { label: "Plan", value: sub.planName },
        ]
      : [
          { label: "Category", value: preview.categoryCommission?.categoryName || "—" },
          { label: "Applies to bookings", value: prettyRange(preview.categoryCommission?.activeSlabRange) },
        ];

  const cta = isMember
    ? { to: "/provider/subscriptions", text: "Manage plan" }
    : isTrial
      ? { to: "/provider/subscriptions", text: "Upgrade early" }
      : { to: "/provider/subscriptions", text: "Get a lower rate" };

  return (
    <section className="text-left" data-commission-overview>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className={`h-1.5 w-full bg-gradient-to-r ${isTrial ? "from-emerald-400 to-teal-500" : isMember ? "from-violet-500 to-fuchsia-500" : "from-emerald-500 to-sky-500"}`} />
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Percent className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-foreground">Your commission</h3>
              <p className="line-clamp-2 text-xs font-medium leading-snug text-muted-foreground">
                {preview.currentRule || "Charged on each completed booking"}
              </p>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone.chip}`}>
            <Icon className="h-3 w-3" /> {chip}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4 px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current rate</p>
            <p className={`text-4xl font-black leading-none tracking-tight ${tone.rate}`}>
              {rate}
              <span className="text-2xl">%</span>
            </p>
          </div>
          <div className="max-w-[12rem] pb-0.5 text-right" data-commission-example>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">On a ₹1,000 job you keep</p>
            <p className="text-lg font-black leading-tight text-foreground">{rupees(1000 - (1000 * rate) / 100)}</p>
          </div>
        </div>

        {isTrial && (
          <div className="mt-4 px-5" data-free-jobs-progress>
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>Free jobs used</span>
              <span>{Math.max(0, FREE_JOBS - Number(preview.remainingFreeServices ?? 0))} of {FREE_JOBS}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                style={{ width: `${Math.min(100, (Math.max(0, FREE_JOBS - Number(preview.remainingFreeServices ?? 0)) / FREE_JOBS) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">No commission on your first free jobs.</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5 px-5">
          {stats.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}
        </div>

        <Link
          to={cta.to}
          className="mt-4 flex items-center justify-between border-t border-border px-5 py-3 text-xs font-extrabold text-primary transition-colors hover:bg-muted/50"
        >
          {cta.text}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};

export default CommissionOverviewCard;
