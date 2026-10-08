import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, FileUp, XCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import API from "@/lib/api";
import { partnerDocumentStatus } from "@/lib/documentStatus";

const STATES = {
  none: {
    icon: FileUp,
    title: "Documents Pending",
    body: "Upload your documents to get verified and start receiving bookings.",
    cta: "Upload Documents",
    tone: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    iconTone: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  draft: {
    icon: AlertTriangle,
    title: "Documents Pending",
    body: "Your documents are saved but not yet submitted. Complete and submit them for verification.",
    cta: "Complete Documents",
    tone: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    iconTone: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  review: {
    icon: Clock,
    title: "Documents Under Review",
    body: "Your documents are currently under verification. We'll notify you once they're checked.",
    cta: "View Documents",
    tone: "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30",
    iconTone: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
    button: "bg-sky-600 hover:bg-sky-700",
  },
  rejected: {
    icon: XCircle,
    title: "Documents Rejected",
    body: "Some documents were rejected. Please re-upload them to continue verification.",
    cta: "Re-upload Documents",
    tone: "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30",
    iconTone: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
    button: "bg-rose-600 hover:bg-rose-700",
  },
  verified: {
    icon: CheckCircle2,
    title: "Documents Verified",
    body: "All your documents are verified. Your account is waiting for final approval.",
    cta: "View Documents",
    tone: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
    iconTone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
};

/**
 * The partner's document verification status on the Home page, read from
 * the documents on their profile. Nothing is shown once every document is
 * verified, unless `showVerified` (the approval-pending screen, where
 * "verified, waiting for approval" is the useful thing to say).
 */
const DocumentStatusCard = ({ showVerified = false, className = "" }) => {
  const { user, updateUser } = useAuth();
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  // Fresh status when the partner comes back to the app (e.g. after admin
  // reviewed a document); the profile is otherwise reloaded on navigation.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { data } = await API.get("/provider/profile");
        updateUserRef.current({ documents: data.documents, kycStatus: data.kycStatus, kycVerified: data.kycVerified, status: data.status });
      } catch { /* keep what we have */ }
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!user) return null;
  const status = partnerDocumentStatus(user);
  if (status.state === "verified" && !showVerified) return null;
  const view = STATES[status.state];
  const Icon = view.icon;

  return (
    <section className={`w-full rounded-3xl border-2 p-4 md:p-5 text-left ${view.tone} ${className}`} data-document-status={status.state}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center ${view.iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm md:text-base font-black tracking-tight text-foreground">{view.title}</h2>
            {status.state === "rejected" && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Re-upload required</span>
            )}
            {status.total > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground">{status.verified} of {status.total} verified</span>
            )}
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">{view.body}</p>
          {status.rejected.length > 0 && (
            <ul className="mt-2 space-y-1">
              {status.rejected.map((d) => (
                <li key={d.id} className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  {d.label}{d.reason ? <span className="font-medium text-rose-600/90 dark:text-rose-400"> — {d.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Link
        to="/provider/documents"
        className={`mt-4 flex w-full sm:w-auto sm:inline-flex items-center justify-center gap-1.5 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition-colors ${view.button}`}
      >
        {view.cta} <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
};

export default DocumentStatusCard;
